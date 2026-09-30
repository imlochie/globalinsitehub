import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitoringRouter from "./monitoring";
import camerasRouter from "./cameras";

const router: IRouter = Router();

router.use(healthRouter);
router.use(monitoringRouter);
router.use(camerasRouter);

export default router;
