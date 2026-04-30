import { Schema, model, type Document, type Types } from "mongoose";

export interface IPledgedItem extends Document {
  _id: Types.ObjectId;
  id: string;
  title: string;
  category: "GOLD" | "SILVER" | "DIAMOND" | "OTHER";
  grossWeightG: number;
  netWeightG: number;
  pledgedValue: number;
  loanId: string;
  customer: string;
  status: "VAULTED" | "RELEASED" | "AUCTION";
  vaultLoc?: string;
  photos?: string[];
}

const pledgedItemSchema = new Schema<IPledgedItem>(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ["GOLD", "SILVER", "DIAMOND", "OTHER"],
      required: true,
    },
    grossWeightG: { type: Number, required: true },
    netWeightG: { type: Number, required: true },
    pledgedValue: { type: Number, required: true },
    loanId: { type: String, required: true },
    customer: { type: String, required: true },
    status: {
      type: String,
      enum: ["VAULTED", "RELEASED", "AUCTION"],
      default: "VAULTED",
    },
    vaultLoc: String,
    photos: [String],
  },
  { collection: "pledgedItems" },
);

export const PledgedItem = model<IPledgedItem>("PledgedItem", pledgedItemSchema);
