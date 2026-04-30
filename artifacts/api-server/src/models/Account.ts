import { Schema, model, type Document, type Types } from "mongoose";

export interface IAccount extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  type: "CASH" | "BANK";
  subtitle?: string;
  openingBalance: number;
  openedAtIso: string;
}

const accountSchema = new Schema<IAccount>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["CASH", "BANK"], required: true },
    subtitle: String,
    openingBalance: { type: Number, default: 0 },
    openedAtIso: { type: String, required: true },
  },
  { collection: "accounts" },
);

export const Account = model<IAccount>("Account", accountSchema);
