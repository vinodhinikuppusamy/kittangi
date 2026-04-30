import { Schema, model, type Document, type Types } from "mongoose";

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  id: string; // human-readable code e.g. C-001
  fullName: string;
  phone: string;
  email?: string;
  kycStatus: "Pending" | "Verified" | "Rejected";
  activeLoans: number;
  photoDataUrl?: string;
  dob?: string;
  aadhar?: string;
  pan?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  createdAtIso: string;
}

const customerSchema = new Schema<ICustomer>(
  {
    id: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    kycStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    activeLoans: { type: Number, default: 0 },
    photoDataUrl: String,
    dob: String,
    aadhar: String,
    pan: String,
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    createdAtIso: { type: String, required: true },
  },
  { collection: "customers" },
);

export const Customer = model<ICustomer>("Customer", customerSchema);
