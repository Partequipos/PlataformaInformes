import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';

// Import middleware
import { generalLimiter } from './middleware/rateLimit';
import { sanitizeAll } from './middleware/sanitization';
import metricsCollector from './utils/metrics';

// Import routes
import authRoutes from './routes/auth';
import reportRoutes from './routes/reports';
import machineTypeRoutes from './routes/machineTypes';
import componentTypeRoutes from './routes/componentTypes';
import alertRoutes from './routes/alerts';
import devRoutes from './routes/dev';
import resourceRoutes from './routes/resource';
import parameterRoutes from './routes/parameter';
import cleanRoutes from './routes/clean';
import actRoutes from './routes/acts';


console.log('NODE_ENV:', process.env.NODE_ENV); // <-- Diagnóstico

const app = express();
app.set('trust proxy', 1); // Permitir proxy headers en Vercel
const PORT = process.env.PORT || 3001;

// Prepare allowed origins for CORS and CSP
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', ...allowedOrigins, 'http://localhost:3001'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", ...allowedOrigins, 'http://localhost:3001'],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// CORS configuration
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting middleware
app.use(generalLimiter);

// Metrics collection middleware
app.use(metricsCollector.collectMetrics.bind(metricsCollector));

// Logging middleware
app.use(morgan('combined'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sanitization middleware
app.use(sanitizeAll);

// Error handling middleware for request size limits
app.use((error: any, req: any, res: any, next: any) => {
  if (error.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'Request too large. Please reduce the number of photos or their size.'
    });
  }
  
  next(error);
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    success: true,
    data: metricsCollector.getMetrics()
  });
});

// API routes — authLimiter only on login/register (see auth routes), not the whole router
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/machine-types', machineTypeRoutes);
app.use('/api/component-types', componentTypeRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/parameters', parameterRoutes);
app.use('/api/clean', cleanRoutes);
app.use('/api/acts', actRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
module.exports = app; 