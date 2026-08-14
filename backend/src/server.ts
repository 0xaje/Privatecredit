import express from 'express';
import cors from 'cors';
import { config } from './config';
import { attestcoinRouter } from './routes/attestcoin.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { graphRouter } from './routes/graph.routes';
import { assessmentRouter } from './routes/assessment.routes';
import { loansRouter } from './routes/loans.routes';
import { judgeRouter } from './routes/judge.routes';
import { artefactsRouter } from './routes/artefacts.routes';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/attestcoin', attestcoinRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/graph', graphRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/loans', loansRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/artefacts', artefactsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PrivateCredit Graph API', mode: config.appMode, chainId: config.chainId });
});

app.listen(config.port, () => {
  console.log(`Backend server running in ${config.appMode} mode on port ${config.port}`);
});
