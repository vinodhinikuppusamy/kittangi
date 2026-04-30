import { Schema, model, type Document, type Types } from "mongoose";

export interface ISettings extends Document {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
  },
  { collection: "settings" },
);

export const Settings = model<ISettings>("Settings", settingsSchema);
