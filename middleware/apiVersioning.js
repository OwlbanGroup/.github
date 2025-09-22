/**
 * API Versioning Middleware
 * Provides comprehensive API versioning and deprecation management
 */

const semver = require('semver');

// API version configuration
const API_VERSIONS = {
  '1.0.0': {
    deprecated: false,
    sunsetDate: null,
    supported: true,
    features: ['basic-auth', 'financial-data', 'ai-integration', 'gpu-metrics']
  },
  '1.1.0': {
    deprecated: false,
    sunsetDate: null,
    supported: true,
    features: ['websocket-realtime', 'advanced-analytics', 'multi-ai-platforms']
  },
  '2.0.0': {
    deprecated: false,
    sunsetDate: null,
    supported: true,
    features: ['distributed-tracing', 'enhanced-security', 'performance-optimization']
  }
};

// Default API version
const DEFAULT_VERSION = '2.0.0';

// Version validation middleware
const validateApiVersion = (req, res, next) => {
  const version = req.headers['x-api-version'] || req.query.version || DEFAULT_VERSION;

  if (!semver.valid(version)) {
    return res.status(400).json({
      error: 'Invalid API version format',
      provided: version,
      expected: 'Semantic version (e.g., 1.0.0, 2.0.0)',
      supported: Object.keys(API_VERSIONS)
    });
  }

  if (!API_VERSIONS[version]) {
    return res.status(404).json({
      error: 'API version not found',
      provided: version,
      supported: Object.keys(API_VERSIONS),
      latest: DEFAULT_VERSION
    });
  }

  const versionInfo = API_VERSIONS[version];

  if (!versionInfo.supported) {
    return res.status(410).json({
      error: 'API version no longer supported',
      version: version,
      sunsetDate: versionInfo.sunsetDate,
      latest: DEFAULT_VERSION
    });
  }

  // Add version info to request
  req.apiVersion = {
    version: version,
    info: versionInfo,
    isDeprecated: versionInfo.deprecated,
    sunsetDate: versionInfo.sunsetDate
  };

  // Add deprecation headers if needed
  if (versionInfo.deprecated) {
    res.set({
      'X-API-Deprecated': 'true',
      'X-API-Sunset-Date': versionInfo.sunsetDate,
      'X-API-Latest-Version': DEFAULT_VERSION
    });
  }

  next();
};

// Version-specific routing middleware
const routeByVersion = (versionMap) => {
  return (req, res, next) => {
    const currentVersion = req.apiVersion.version;
    const handler = versionMap[currentVersion] || versionMap['default'];

    if (!handler) {
      return res.status(404).json({
        error: 'Endpoint not available in this API version',
        version: currentVersion,
        availableVersions: Object.keys(versionMap)
      });
    }

    // Execute version-specific handler
    handler(req, res, next);
  };
};

// API compatibility middleware
const ensureCompatibility = (req, res, next) => {
  const version = req.apiVersion.version;
  const versionInfo = req.apiVersion.info;

  // Check for breaking changes
  if (semver.major(version) < semver.major(DEFAULT_VERSION)) {
    // Major version difference - potential breaking changes
    res.set('X-API-Compatibility-Warning', 'Major version difference detected');
  }

  // Feature availability check
  if (req.route && req.route.path) {
    const endpoint = req.route.path;
    const requiredFeatures = getRequiredFeatures(endpoint);

    const missingFeatures = requiredFeatures.filter(feature =>
      !versionInfo.features.includes(feature)
    );

    if (missingFeatures.length > 0) {
      return res.status(400).json({
        error: 'API version does not support required features',
        version: version,
        missingFeatures: missingFeatures,
        requiredFeatures: requiredFeatures,
        upgradeTo: suggestVersion(requiredFeatures)
      });
    }
  }

  next();
};

// Helper function to determine required features for an endpoint
const getRequiredFeatures = (endpoint) => {
  const featureMap = {
    '/api/ai/': ['ai-integration'],
    '/api/financial/': ['financial-data'],
    '/api/websocket': ['websocket-realtime'],
    '/api/nvidia/': ['gpu-metrics'],
    '/api/auth/': ['basic-auth']
  };

  for (const [pattern, features] of Object.entries(featureMap)) {
    if (endpoint.includes(pattern)) {
      return features;
    }
  }

  return ['basic-auth']; // Default requirement
};

// Helper function to suggest appropriate version
const suggestVersion = (requiredFeatures) => {
  for (const [version, info] of Object.entries(API_VERSIONS)) {
    if (info.supported && requiredFeatures.every(feature =>
      info.features.includes(feature)
    )) {
      return version;
    }
  }
  return DEFAULT_VERSION;
};

// API version information endpoint
const getVersionInfo = (req, res) => {
  const version = req.apiVersion.version;

  res.json({
    currentVersion: version,
    versionInfo: req.apiVersion.info,
    allVersions: API_VERSIONS,
    defaultVersion: DEFAULT_VERSION,
    latestVersion: DEFAULT_VERSION,
    deprecationPolicy: {
      majorVersions: 'Supported for 2 years',
      minorVersions: 'Supported for 1 year',
      patchVersions: 'Supported until next patch'
    }
  });
};

// Migration helper middleware
const addMigrationHeaders = (req, res, next) => {
  const version = req.apiVersion.version;

  if (semver.lt(version, DEFAULT_VERSION)) {
    res.set({
      'X-API-Migration-Available': 'true',
      'X-API-Migration-Guide': `/api/v2/migration-guide`,
      'X-API-Breaking-Changes': getBreakingChanges(version)
    });
  }

  next();
};

// Get breaking changes between versions
const getBreakingChanges = (fromVersion) => {
  const changes = {
    '1.0.0': [
      'Authentication method changed from Basic to JWT',
      'Response format for financial data updated',
      'New required fields in AI endpoints'
    ],
    '1.1.0': [
      'WebSocket endpoints require explicit subscription',
      'Rate limiting headers changed',
      'Error response format standardized'
    ]
  };

  return changes[fromVersion] || ['No breaking changes documented'];
};

// Version-specific response formatting
const formatResponse = (req, res, next) => {
  const originalJson = res.json;
  const version = req.apiVersion.version;

  res.json = function(data) {
    // Add version metadata to responses
    const responseData = {
      ...data,
      _metadata: {
        apiVersion: version,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        deprecated: req.apiVersion.isDeprecated
      }
    };

    // Version-specific formatting
    if (semver.satisfies(version, '<2.0.0')) {
      // Legacy format adjustments
      responseData.api_version = version; // snake_case for older versions
      delete responseData._metadata; // Remove new metadata format
    }

    return originalJson.call(this, responseData);
  };

  next();
};

// Generate unique request ID
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Export middleware functions
module.exports = {
  validateApiVersion,
  routeByVersion,
  ensureCompatibility,
  getVersionInfo,
  addMigrationHeaders,
  formatResponse,
  API_VERSIONS,
  DEFAULT_VERSION
};
