import { Schema, model, type Document, type Types } from "mongoose";

const payoutSchema = new Schema(
  {
    id: String,
    paidAtIso: String,
    amount: Number,
    note: String,
  },
  { _id: false },
);

export interface IInvestor extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  contact: string;
  depositDateIso: string;
  principal: number;
  monthlyRatePct: number;
  payoutCycle: string;
  status: "ACTIVE" | "CLOSED";
  payouts: unknown[];
}

const investorSchema = new Schema<IInvestor>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contact: { type: String, required: true },
    depositDateIso: { type: String, required: true },
    principal: { type: Number, required: true },
    monthlyRatePct: { type: Number, required: true },
    payoutCycle: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "CLOSED"], default: "ACTIVE" },
    payouts: [payoutSchema],
  },
  { collection: "investors" },
);

export const Investor = model<IInvestor>("Investor", investorSchema);
