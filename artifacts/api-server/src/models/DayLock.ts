import { Schema, model, type Document, type Types } from "mongoose";

export interface IDayLock extends Document {
  _id: Types.ObjectId;
  dateIso: string;
  lockedByUserId: string;
  lockedAtIso: string;
}

const dayLockSchema = new Schema<IDayLock>(
  {
    dateIso: { type: String, required: true, unique: true },
    lockedByUserId: { type: String, required: true },
    lockedAtIso: { type: String, required: true },
  },
  { collection: "dayLocks" },
);

export const DayLock = model<IDayLock>("DayLock", dayLockSchema);
