import express from 'express';
import path from 'path';
import nunjucks from 'nunjucks';
import cookieParser from 'cookie-parser';
import session from 'express-session';

import { instanceMiddleware } from './middleware/instance';
import { verifierMiddleware } from './middleware/verifier';
import { errorMiddleware } from './middleware/error';

import routes from './routes';

const app = express();

// Configure Nunjucks
const viewsPath = path.join(__dirname, '../views');
nunjucks.configure(viewsPath, {
  autoescape: true,
  express: app,
  watch: process.env.NODE_ENV !== 'production',
});
app.set('view engine', 'njk');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'changeme',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (before instance middleware to avoid creating instances)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Instance and verifier middleware
app.use(instanceMiddleware);
app.use(verifierMiddleware);

// Make instance and verifiers available to all templates
app.use((req, res, next) => {
  res.locals.instanceId = req.instanceId;
  res.locals.authVerifierId = req.authVerifierId;
  res.locals.regVerifierId = req.regVerifierId;
  res.locals.authVerifier = req.authVerifier;
  res.locals.regVerifier = req.regVerifier;
  res.locals.user = req.session?.user || null;
  next();
});

// Routes
app.use(routes);

// Error handling
app.use(errorMiddleware);

export default app;
