import express from 'express';

const router = express.Router();

/**
 * Default route.
 */
router.get('/', (req, res) => {
  res.send('Welcome to tapt!');
});

/**
 * Health check route.
 */
router.get('/health', (req, res) => {
  res.status(200).send('Ok!');
});

export default router;
