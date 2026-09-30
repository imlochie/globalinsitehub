import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitoringRouter from "./monitoring";
import camerasRouter from "./cameras";
import maritimeRouter from "./maritime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(monitoringRouter);
router.use(camerasRouter);
router.use(maritimeRouter);

export default router;
