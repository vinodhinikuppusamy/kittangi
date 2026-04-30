import { Schema, model, type Document, type Types } from "mongoose";

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  id: string;
  atIso: string;
  actor: string;
  kind: string;
  summary: string;
  link?: string;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    id: { type: String, required: true, unique: true },
    atIso: { type: String, required: true },
    actor: { type: String, required: true },
    kind: { type: String, required: true },
    summary: { type: String, required: true },
    link: String,
  },
  { collection: "activityLogs" },
);

export const ActivityLog = model<IActivityLog>("ActivityLog", activityLogSchema);
