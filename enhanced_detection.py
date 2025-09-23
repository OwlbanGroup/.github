"""
Enhanced Detection Module for AI Dashboard
Provides advanced threat detection, anomaly detection, and security monitoring
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import json
from dataclasses import dataclass
from enum import Enum
import hashlib
import hmac
import secrets
from cryptography.fernet import Fernet
import redis
import asyncio
from concurrent.futures import ThreadPoolExecutor
import tensorflow as tf
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os

class ThreatLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AnomalyType(Enum):
    BEHAVIORAL = "behavioral"
    TRAFFIC = "traffic"
    AUTHENTICATION = "authentication"
    DATA_ACCESS = "data_access"
    PERFORMANCE = "performance"

@dataclass
class DetectionResult:
    """Data class for detection results"""
    timestamp: datetime
    threat_level: ThreatLevel
    anomaly_type: AnomalyType
    confidence: float
    details: Dict[str, Any]
    source_ip: str
    user_id: Optional[str]
    session_id: str
    recommendation: str
    evidence: List[str]

@dataclass
class SecurityMetrics:
    """Security metrics for monitoring"""
    total_requests: int = 0
    suspicious_requests: int = 0
    blocked_requests: int = 0
    average_response_time: float = 0.0
    error_rate: float = 0.0
    unique_ips: int = 0
    failed_logins: int = 0
    successful_logins: int = 0

class EnhancedDetection:
    """Enhanced detection system with ML-based anomaly detection"""

    def __init__(self, redis_client: redis.Redis = None):
        self.logger = logging.getLogger(__name__)
        self.redis_client = redis_client or redis.Redis(host='localhost', port=6379, db=0)

        # Initialize ML models
        self._initialize_ml_models()

        # Security configurations
        self.max_requests_per_minute = 1000
        self.max_failed_logins = 5
        self.suspicious_patterns = self._load_suspicious_patterns()
        self.encryption_key = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
        self.cipher = Fernet(self.encryption_key)

        # Metrics storage
        self.metrics = SecurityMetrics()

        # Thread pool for async operations
        self.executor = ThreadPoolExecutor(max_workers=4)

    def _initialize_ml_models(self):
        """Initialize machine learning models for anomaly detection"""
        try:
            # Load pre-trained models or create new ones
            model_path = os.getenv('MODEL_PATH', './models')

            if os.path.exists(f'{model_path}/isolation_forest.pkl'):
                self.isolation_forest = joblib.load(f'{model_path}/isolation_forest.pkl')
                self.scaler = joblib.load(f'{model_path}/scaler.pkl')
            else:
                # Create new models
                self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
                self.scaler = StandardScaler()

                # Train on sample data (in production, use historical data)
                sample_data = np.random.normal(0, 1, (1000, 10))
                self.scaler.fit(sample_data)
                self.isolation_forest.fit(sample_data)

                # Save models
                os.makedirs(model_path, exist_ok=True)
                joblib.dump(self.isolation_forest, f'{model_path}/isolation_forest.pkl')
                joblib.dump(self.scaler, f'{model_path}/scaler.pkl')

        except Exception as e:
            self.logger.warning(f"Failed to initialize ML models: {e}")
            self.isolation_forest = None
            self.scaler = None

    def _load_suspicious_patterns(self) -> Dict[str, Any]:
        """Load suspicious patterns from configuration"""
        return {
            'sql_injection': [
                r'(\bselect\b|\bunion\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b)',
                r'(\bor\s+\d+\s*=\s*\d+|\band\s+\d+\s*=\s*\d+)',
                r'(--|#|/\*|\*/)',
                r'(\bexec\b|\bexecute\b|\bsp_\b)',
                r'(\bxp_cmdshell\b|\bopenrowset\b|\bopendir\b)'
            ],
            'xss_patterns': [
                r'(<script[^>]*>.*?</script>)',
                r'(javascript:|vbscript:|data:text/html)',
                r'(on\w+\s*=)',
                r'(<iframe[^>]*>.*?</iframe>)',
                r'(<object[^>]*>.*?</object>)'
            ],
            'path_traversal': [
                r'\.\.[\/\\]',
                r'%2e%2e[\/\\]',
                r'\.\.%2f',
                r'\\+\.\.+\\+'
            ],
            'suspicious_headers': [
                'user-agent', 'referer', 'x-forwarded-for'
            ]
        }

    async def analyze_request(self, request_data: Dict[str, Any]) -> DetectionResult:
        """Analyze a request for potential threats"""
        try:
            # Extract request information
            source_ip = request_data.get('ip', 'unknown')
            user_id = request_data.get('user_id')
            session_id = request_data.get('session_id', self._generate_session_id())
            user_agent = request_data.get('user_agent', '')
            path = request_data.get('path', '')
            method = request_data.get('method', '')
            headers = request_data.get('headers', {})
            body = request_data.get('body', '')
            timestamp = request_data.get('timestamp', datetime.now())

            # Initialize detection results
            threat_level = ThreatLevel.LOW
            confidence = 0.0
            anomaly_type = AnomalyType.BEHAVIORAL
            details = {}
            evidence = []

            # 1. Rate limiting check
            rate_limit_result = await self._check_rate_limit(source_ip, session_id)
            if rate_limit_result['blocked']:
                threat_level = ThreatLevel.HIGH
                confidence = 0.9
                evidence.append(f"Rate limit exceeded: {rate_limit_result['requests']} requests/minute")
                details['rate_limit'] = rate_limit_result

            # 2. Pattern-based detection
            pattern_results = self._detect_suspicious_patterns(path, body, headers, user_agent)
            if pattern_results['detected']:
                threat_level = max(threat_level, ThreatLevel.MEDIUM)
                confidence = max(confidence, 0.8)
                evidence.extend(pattern_results['patterns'])
                details['pattern_detection'] = pattern_results

            # 3. Behavioral analysis
            behavioral_result = await self._analyze_behavior(source_ip, user_id, session_id, path, method)
            if behavioral_result['anomalous']:
                threat_level = max(threat_level, ThreatLevel.MEDIUM)
                confidence = max(confidence, behavioral_result['confidence'])
                evidence.append(behavioral_result['reason'])
                details['behavioral_analysis'] = behavioral_result

            # 4. ML-based anomaly detection
            if self.isolation_forest and self.scaler:
                ml_result = self._ml_anomaly_detection(request_data)
                if ml_result['anomalous']:
                    threat_level = max(threat_level, ThreatLevel.HIGH)
                    confidence = max(confidence, ml_result['confidence'])
                    evidence.append(f"ML anomaly detected: {ml_result['score']}")
                    details['ml_detection'] = ml_result

            # 5. Authentication analysis
            auth_result = await self._analyze_authentication(user_id, session_id, source_ip)
            if auth_result['suspicious']:
                threat_level = max(threat_level, ThreatLevel.HIGH)
                confidence = max(confidence, 0.9)
                evidence.extend(auth_result['reasons'])
                details['auth_analysis'] = auth_result

            # Determine final threat level
            if len(evidence) > 3 or confidence > 0.8:
                threat_level = ThreatLevel.CRITICAL
            elif len(evidence) > 1 or confidence > 0.6:
                threat_level = ThreatLevel.HIGH
            elif len(evidence) > 0 or confidence > 0.4:
                threat_level = ThreatLevel.MEDIUM

            # Generate recommendation
            recommendation = self._generate_recommendation(threat_level, evidence)

            return DetectionResult(
                timestamp=timestamp,
                threat_level=threat_level,
                anomaly_type=anomaly_type,
                confidence=confidence,
                details=details,
                source_ip=source_ip,
                user_id=user_id,
                session_id=session_id,
                recommendation=recommendation,
                evidence=evidence
            )

        except Exception as e:
            self.logger.error(f"Error in request analysis: {e}")
            return DetectionResult(
                timestamp=datetime.now(),
                threat_level=ThreatLevel.LOW,
                anomaly_type=AnomalyType.BEHAVIORAL,
                confidence=0.0,
                details={'error': str(e)},
                source_ip=request_data.get('ip', 'unknown'),
                user_id=request_data.get('user_id'),
                session_id=request_data.get('session_id', ''),
                recommendation='Monitor request due to analysis error',
                evidence=[f'Analysis error: {str(e)}']
            )

    async def _check_rate_limit(self, ip: str, session_id: str) -> Dict[str, Any]:
        """Check if request exceeds rate limits"""
        try:
            # Check IP-based rate limit
            ip_key = f"rate_limit:ip:{ip}"
            session_key = f"rate_limit:session:{session_id}"

            current_time = datetime.now()
            window_start = current_time - timedelta(minutes=1)

            # Get request counts
            ip_requests = await self._get_request_count(ip_key, window_start)
            session_requests = await self._get_request_count(session_key, window_start)

            # Update counters
            await self._increment_request_count(ip_key)
            await self._increment_request_count(session_key)

            # Check limits
            blocked = False
            reason = ""

            if ip_requests > self.max_requests_per_minute:
                blocked = True
                reason = f"IP rate limit exceeded: {ip_requests} requests/minute"

            if session_requests > self.max_requests_per_minute * 0.5:  # Session limit is half of IP limit
                blocked = True
                reason += f" Session rate limit exceeded: {session_requests} requests/minute"

            return {
                'blocked': blocked,
                'ip_requests': ip_requests,
                'session_requests': session_requests,
                'reason': reason,
                'limit': self.max_requests_per_minute
            }

        except Exception as e:
            self.logger.error(f"Rate limit check error: {e}")
            return {'blocked': False, 'error': str(e)}

    async def _get_request_count(self, key: str, window_start: datetime) -> int:
        """Get request count for a key within time window"""
        try:
            # In a real implementation, use Redis sorted sets for time windows
            count = self.redis_client.get(key)
            return int(count) if count else 0
        except Exception:
            return 0

    async def _increment_request_count(self, key: str):
        """Increment request count for a key"""
        try:
            # Use Redis increment with expiration
            self.redis_client.incr(key)
            self.redis_client.expire(key, 60)  # Expire after 60 seconds
        except Exception as e:
            self.logger.error(f"Error incrementing request count: {e}")

    def _detect_suspicious_patterns(self, path: str, body: str, headers: Dict, user_agent: str) -> Dict[str, Any]:
        """Detect suspicious patterns in request data"""
        import re

        detected_patterns = []
        detected = False

        # Check SQL injection patterns
        for pattern in self.suspicious_patterns['sql_injection']:
            if re.search(pattern, path.lower(), re.IGNORECASE) or \
               re.search(pattern, body.lower(), re.IGNORECASE):
                detected_patterns.append(f"SQL injection pattern: {pattern}")
                detected = True

        # Check XSS patterns
        for pattern in self.suspicious_patterns['xss_patterns']:
            if re.search(pattern, path.lower(), re.IGNORECASE) or \
               re.search(pattern, body.lower(), re.IGNORECASE):
                detected_patterns.append(f"XSS pattern: {pattern}")
                detected = True

        # Check path traversal
        for pattern in self.suspicious_patterns['path_traversal']:
            if re.search(pattern, path.lower(), re.IGNORECASE):
                detected_patterns.append(f"Path traversal pattern: {pattern}")
                detected = True

        # Check suspicious headers
        for header in self.suspicious_patterns['suspicious_headers']:
            if header in headers:
                header_value = headers[header]
                if len(header_value) > 1000 or 'script' in header_value.lower():
                    detected_patterns.append(f"Suspicious header {header}: {header_value[:100]}...")
                    detected = True

        # Check user agent
        if user_agent:
            if len(user_agent) > 500 or 'bot' in user_agent.lower():
                detected_patterns.append(f"Suspicious user agent: {user_agent[:100]}...")
                detected = True

        return {
            'detected': detected,
            'patterns': detected_patterns,
            'total_patterns': len(detected_patterns)
        }

    async def _analyze_behavior(self, ip: str, user_id: str, session_id: str, path: str, method: str) -> Dict[str, Any]:
        """Analyze user behavior for anomalies"""
        try:
            # Get user behavior history
            behavior_key = f"behavior:{user_id or ip}"
            behavior_data = self.redis_client.get(behavior_key)

            if behavior_data:
                behavior_history = json.loads(behavior_data)
            else:
                behavior_history = {
                    'paths': [],
                    'methods': [],
                    'timestamps': [],
                    'response_times': []
                }

            # Update behavior history
            behavior_history['paths'].append(path)
            behavior_history['methods'].append(method)
            behavior_history['timestamps'].append(datetime.now().isoformat())

            # Keep only last 100 entries
            for key in behavior_history:
                behavior_history[key] = behavior_history[key][-100:]

            # Analyze for anomalies
            anomalous = False
            confidence = 0.0
            reason = ""

            # Check for unusual path patterns
            if len(behavior_history['paths']) > 10:
                unique_paths = set(behavior_history['paths'])
                if len(unique_paths) / len(behavior_history['paths']) < 0.1:  # Very repetitive
                    anomalous = True
                    confidence = 0.7
                    reason = "Unusual repetitive behavior detected"

            # Check for rapid path changes
            if len(behavior_history['paths']) > 5:
                recent_paths = behavior_history['paths'][-5:]
                if len(set(recent_paths)) == len(recent_paths):  # All different paths
                    anomalous = True
                    confidence = 0.6
                    reason = "Unusual rapid path changes detected"

            # Save updated behavior
            self.redis_client.setex(
                behavior_key,
                3600,  # Expire after 1 hour
                json.dumps(behavior_history)
            )

            return {
                'anomalous': anomalous,
                'confidence': confidence,
                'reason': reason,
                'behavior_summary': {
                    'total_requests': len(behavior_history['paths']),
                    'unique_paths': len(set(behavior_history['paths'])),
                    'unique_methods': len(set(behavior_history['methods']))
                }
            }

        except Exception as e:
            self.logger.error(f"Behavioral analysis error: {e}")
            return {'anomalous': False, 'confidence': 0.0, 'reason': f'Analysis error: {str(e)}'}

    def _ml_anomaly_detection(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """ML-based anomaly detection"""
        try:
            if not self.isolation_forest or not self.scaler:
                return {'anomalous': False, 'confidence': 0.0, 'score': 0.0}

            # Extract features from request data
            features = self._extract_features(request_data)

            # Scale features
            scaled_features = self.scaler.transform([features])

            # Predict anomaly
            anomaly_score = self.isolation_forest.decision_function(scaled_features)[0]
            is_anomalous = self.isolation_forest.predict(scaled_features)[0] == -1

            # Convert score to confidence (higher score = more normal)
            confidence = max(0, min(1, (anomaly_score + 0.5) / 0.5)) if is_anomalous else 0.0

            return {
                'anomalous': is_anomalous,
                'confidence': confidence,
                'score': float(anomaly_score),
                'features': features
            }

        except Exception as e:
            self.logger.error(f"ML anomaly detection error: {e}")
            return {'anomalous': False, 'confidence': 0.0, 'score': 0.0}

    def _extract_features(self, request_data: Dict[str, Any]) -> List[float]:
        """Extract numerical features from request data for ML analysis"""
        features = []

        # Request characteristics
        path = request_data.get('path', '')
        method = request_data.get('method', '')
        user_agent = request_data.get('user_agent', '')
        body = request_data.get('body', '')

        # Feature 1: Path length
        features.append(len(path))

        # Feature 2: Method encoding (GET=0, POST=1, PUT=2, DELETE=3, etc.)
        method_map = {'GET': 0, 'POST': 1, 'PUT': 2, 'DELETE': 3, 'PATCH': 4}
        features.append(method_map.get(method, 5))

        # Feature 3: Number of special characters in path
        features.append(len([c for c in path if c in ['<', '>', '"', "'", '&', '%']]))

        # Feature 4: User agent length
        features.append(len(user_agent))

        # Feature 5: Body length
        features.append(len(body))

        # Feature 6: Number of headers
        features.append(len(request_data.get('headers', {})))

        # Feature 7: Has authentication
        features.append(1 if request_data.get('user_id') else 0)

        # Feature 8: Time-based features (hour of day)
        features.append(datetime.now().hour / 24.0)

        # Feature 9: Day of week
        features.append(datetime.now().weekday() / 7.0)

        # Feature 10: Path entropy (measure of randomness)
        if path:
            from collections import Counter
            path_chars = Counter(path.lower())
            entropy = -sum((count/len(path)) * np.log2(count/len(path)) for count in path_chars.values())
            features.append(entropy)
        else:
            features.append(0.0)

        return features

    async def _analyze_authentication(self, user_id: str, session_id: str, ip: str) -> Dict[str, Any]:
        """Analyze authentication patterns for anomalies"""
        try:
            suspicious = False
            reasons = []
            confidence = 0.0

            if not user_id:
                return {'suspicious': False, 'reasons': [], 'confidence': 0.0}

            # Check failed login attempts
            failed_login_key = f"failed_logins:{user_id}"
            failed_count = self.redis_client.get(failed_login_key)

            if failed_count and int(failed_count) > self.max_failed_logins:
                suspicious = True
                reasons.append(f"Multiple failed login attempts: {failed_count}")
                confidence = 0.8

            # Check login from different IPs
            login_ip_key = f"login_ips:{user_id}"
            recent_ips = self.redis_client.smembers(login_ip_key)

            if len(recent_ips) > 5:  # More than 5 different IPs in recent history
                suspicious = True
                reasons.append(f"Login from multiple IPs: {len(recent_ips)} different IPs")
                confidence = max(confidence, 0.6)

            # Check rapid login attempts
            rapid_login_key = f"rapid_logins:{ip}"
            recent_logins = self.redis_client.get(rapid_login_key)

            if recent_logins and int(recent_logins) > 10:  # More than 10 logins in short time
                suspicious = True
                reasons.append(f"Rapid login attempts from IP: {recent_logins}")
                confidence = max(confidence, 0.7)

            # Update tracking data
            if suspicious:
                self.redis_client.incr(failed_login_key)
                self.redis_client.expire(failed_login_key, 3600)  # Expire after 1 hour

                self.redis_client.sadd(login_ip_key, ip)
                self.redis_client.expire(login_ip_key, 86400)  # Expire after 24 hours

                self.redis_client.incr(rapid_login_key)
                self.redis_client.expire(rapid_login_key, 300)  # Expire after 5 minutes

            return {
                'suspicious': suspicious,
                'reasons': reasons,
                'confidence': confidence
            }

        except Exception as e:
            self.logger.error(f"Authentication analysis error: {e}")
            return {'suspicious': False, 'reasons': [f'Analysis error: {str(e)}'], 'confidence': 0.0}

    def _generate_recommendation(self, threat_level: ThreatLevel, evidence: List[str]) -> str:
        """Generate security recommendation based on threat level and evidence"""
        recommendations = {
            ThreatLevel.LOW: "Monitor request - no immediate action required",
            ThreatLevel.MEDIUM: "Review request details and consider additional logging",
            ThreatLevel.HIGH: "Consider blocking IP and investigating user behavior",
            ThreatLevel.CRITICAL: "IMMEDIATE ACTION: Block IP, revoke sessions, and conduct security investigation"
        }

        base_recommendation = recommendations.get(threat_level, "Monitor request")

        if evidence:
            base_recommendation += f". Detected issues: {', '.join(evidence[:3])}"

        return base_recommendation

    def _generate_session_id(self) -> str:
        """Generate a secure session ID"""
        return secrets.token_hex(16)

    def get_security_metrics(self) -> Dict[str, Any]:
        """Get current security metrics"""
        return {
            'timestamp': datetime.now().isoformat(),
            'total_requests': self.metrics.total_requests,
            'suspicious_requests': self.metrics.suspicious_requests,
            'blocked_requests': self.metrics.blocked_requests,
            'average_response_time': self.metrics.average_response_time,
            'error_rate': self.metrics.error_rate,
            'unique_ips': self.metrics.unique_ips,
            'failed_logins': self.metrics.failed_logins,
            'successful_logins': self.metrics.successful_logins,
            'threat_level_distribution': {
                'low': 0,  # Would be populated from detection results
                'medium': 0,
                'high': 0,
                'critical': 0
            }
        }

    async def update_metrics(self, detection_result: DetectionResult, response_time: float):
        """Update security metrics"""
        self.metrics.total_requests += 1

        if detection_result.threat_level != ThreatLevel.LOW:
            self.metrics.suspicious_requests += 1

        if detection_result.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
            self.metrics.blocked_requests += 1

        # Update response time (simple moving average)
        alpha = 0.1  # Smoothing factor
        self.metrics.average_response_time = (
            alpha * response_time +
            (1 - alpha) * self.metrics.average_response_time
        )

        # Update unique IPs (simplified - in production use hyperloglog)
        self.metrics.unique_ips = len(self.redis_client.smembers('unique_ips'))

    def encrypt_sensitive_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()

# Global instance
detection_system = EnhancedDetection()

async def analyze_request(request_data: Dict[str, Any]) -> DetectionResult:
    """Convenience function to analyze a request"""
    return await detection_system.analyze_request(request_data)

def get_security_metrics() -> Dict[str, Any]:
    """Get current security metrics"""
    return detection_system.get_security_metrics()
