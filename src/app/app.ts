import express from "express";
import cors from "cors";
import { PaperConfiguration } from '../../../paper-node-configuration/src/app';
import { IEnv } from "../../../paper-node-configuration/src/shared/models/env.interface";

const app: express.Application = express();
const paperConfiguration: PaperConfiguration = new PaperConfiguration(process.env as IEnv, app);
app.disable("x-powered-by");
app.use(cors(paperConfiguration.getCorsOrigin()));

// Parse JSON bodies (as sent by API clients)
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

app.get(
  "/edno",
  async (request: express.Request, response: express.Response) => {
    return response.status(200).send('edno')
  }
);

paperConfiguration.startNodeServer();