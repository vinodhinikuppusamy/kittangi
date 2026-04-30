import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import customersRouter from "./customers.js";
import loansRouter from "./loans.js";
import pledgedItemsRouter from "./pledgedItems.js";
import daybookRouter from "./daybook.js";
import accountsRouter from "./accounts.js";
import investorsRouter from "./investors.js";
import usersRouter from "./users.js";
import dayLocksRouter from "./dayLocks.js";
import branchProfileRouter from "./branchProfile.js";
import settingsRouter from "./settings.js";
import activityLogRouter from "./activityLog.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/customers", customersRouter);
router.use("/loans", loansRouter);
router.use("/pledged-items", pledgedItemsRouter);
router.use("/daybook", daybookRouter);
router.use("/accounts", accountsRouter);
router.use("/investors", investorsRouter);
router.use("/users", usersRouter);
router.use("/day-locks", dayLocksRouter);
router.use("/branch-profile", branchProfileRouter);
router.use("/settings", settingsRouter);
router.use("/activity-log", activityLogRouter);

export default router;
