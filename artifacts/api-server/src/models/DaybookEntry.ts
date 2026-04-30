import { Schema, model, type Document, type Types } from "mongoose";

export interface IDaybookEntry extends Document {
  _id: Types.ObjectId;
  id: string;
  dateIso: string;
  time: string;
  side: "CREDIT" | "DEBIT";
  category: string;
  particulars: string;
  account: string;
  amount: number;
  customerName?: string;
  customerId?: string;
  loanId?: string;
  note?: string;
  reference?: string;
}

const daybookEntrySchema = new Schema<IDaybookEntry>(
  {
    id: { type: String, required: true, unique: true },
    dateIso: { type: String, required: true },
    time: { type: String, required: true },
    side: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    category: { type: String, required: true },
    particulars: { type: String, required: true },
    account: { type: String, required: true },
    amount: { type: Number, required: true },
    customerName: String,
    customerId: String,
    loanId: String,
    note: String,
    reference: String,
  },
  { collection: "daybookEntries" },
);

export const DaybookEntry = model<IDaybookEntry>("DaybookEntry", daybookEntrySchema);
