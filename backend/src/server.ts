import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { attestcoinRouter } from './routes/attestcoin.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { graphRouter } from './routes/graph.routes';
import { assessmentRouter } from './routes/assessment.routes';
import { loansRouter } from './routes/loans.routes';
import { judgeRouter } from './routes/judge.routes';
import { artefactsRouter } from './routes/artefacts.routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Register routes
app.use('/api/attestcoin', attestcoinRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/graph', graphRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/loans', loansRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/artefacts', artefactsRouter);

// Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'PrivateCredit Graph API' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
