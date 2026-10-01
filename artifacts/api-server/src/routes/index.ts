import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitoringRouter from "./monitoring";
import camerasRouter from "./cameras";
import maritimeRouter from "./maritime";
import hazardsRouter from "./hazards";
import publicEventsRouter from "./public-events";
import weatherRouter from "./weather";

const router: IRouter = Router();

router.use(healthRouter);
router.use(monitoringRouter);
router.use(camerasRouter);
router.use(maritimeRouter);
router.use(hazardsRouter);
router.use(publicEventsRouter);
router.use(weatherRouter);

export default router;
