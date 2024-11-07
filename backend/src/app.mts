import express, { Router } from 'express';
import { getCurrentInvoke } from '@codegenie/serverless-express';

const app = express();
const router = Router();

app.use(async (req, res, next) => {
    console.log({
        headers: req.headers,
        method: req.method,
        path: req.path,
    });
    next();
});

app.use(router);

router.get('/health',
  async (req, res) => {
    await new Promise(
      (resolve) => setTimeout(() => resolve(0), 5000)
    );
    res.status(200).json({ test: 123 });
  }
);

export const App = app;
