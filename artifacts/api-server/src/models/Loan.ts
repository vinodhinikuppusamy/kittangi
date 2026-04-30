import { Schema, model, type Document, type Types } from "mongoose";

const legalDocSchema = new Schema(
  {
    type: { type: String, enum: ["RC", "INSURANCE", "AGREEMENT", "PERMIT"] },
    name: String,
    dataUrl: String,
    uploadedAtIso: String,
  },
  { _id: false },
);

const vehicleDetailsSchema = new Schema(
  {
    makeModel: String,
    regNo: String,
    year: String,
    vehicleType: {
      type: String,
      enum: ["TWO_WHEELER", "FOUR_WHEELER", "COMMERCIAL"],
    },
  },
  { _id: false },
);

const receiptSchema = new Schema(
  {
    id: String,
    dateIso: String,
    amount: Number,
    mode: String,
    accountId: String,
    note: String,
  },
  { _id: false },
);

export interface ILoan extends Document {
  _id: Types.ObjectId;
  id: string;
  product: "PAWN" | "VEHICLE" | "DOCUMENT";
  customer: string;
  customerCode: string;
  principal: number;
  ratePctPerAnnum: number;
  startedAtIso: string;
  durationLabel?: string;
  maturityIso?: string;
  status: "ACTIVE" | "CLOSED" | "AUCTION";
  closedAtIso?: string;
  disbursedFromAccountId?: string;
  pledgedItemId?: string;
  vehicleDetails?: Record<string, unknown>;
  notes?: string;
  accruedInterest?: number;
  legalDocs?: unknown[];
  repossessionDetails?: Record<string, unknown>;
  receipts?: unknown[];
}

const loanSchema = new Schema<ILoan>(
  {
    id: { type: String, required: true, unique: true },
    product: { type: String, enum: ["PAWN", "VEHICLE", "DOCUMENT"], required: true },
    customer: { type: String, required: true },
    customerCode: { type: String, required: true },
    principal: { type: Number, required: true },
    ratePctPerAnnum: { type: Number, required: true },
    startedAtIso: { type: String, required: true },
    durationLabel: String,
    maturityIso: String,
    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED", "AUCTION"],
      default: "ACTIVE",
    },
    closedAtIso: String,
    disbursedFromAccountId: String,
    pledgedItemId: String,
    vehicleDetails: vehicleDetailsSchema,
    notes: String,
    accruedInterest: Number,
    legalDocs: [legalDocSchema],
    repossessionDetails: Schema.Types.Mixed,
    receipts: [receiptSchema],
  },
  { collection: "loans" },
);

export const Loan = model<ILoan>("Loan", loanSchema);
