import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

/**
 * Open a fresh browser window with a self-contained 2x2 inch printable label.
 * Embeds a QR (loanId + customer + locker info) plus the locker number and
 * customer name. Used by Vault Management, Pledged Items cards, and the
 * Vehicle origination success dialog so a single, branded tag format is
 * shared across the app.
 *
 * The new window has zero React/Vite deps — we render the QR via
 * `qrcode.react` and serialise the SVG to string before writing the HTML.
 */
export function openLockerTagPrintWindow(args: {
  lockerId: string;
  loanId: string;
  customerName: string;
  safeName: string;
  packageId: string;
}): void {
  const { lockerId, loanId, customerName, safeName, packageId } = args;
  const qrPayload = JSON.stringify({
    type: "kittangi.tag",
    loanId,
    customer: customerName,
    locker: lockerId,
    safe: safeName,
  });
  const qrSvg = renderToStaticMarkup(
    <QRCodeSVG value={qrPayload} size={120} level="M" includeMargin={false} />,
  );
  const safeText = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Locker Tag · ${safeText(lockerId)}</title>
    <style>
      @page { size: 2in 2in; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      .label {
        width: 2in;
        height: 2in;
        padding: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        border: 2px solid #000;
      }
      .locker-no {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 0.5px;
        line-height: 1;
        text-align: center;
      }
      .safe-line {
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-top: 2px;
        color: #111;
      }
      .qr { width: 1in; height: 1in; display: flex; align-items: center; justify-content: center; }
      .qr svg { width: 100%; height: 100%; display: block; }
      .footer {
        text-align: center;
        font-size: 8px;
        font-weight: 600;
        line-height: 1.15;
        width: 100%;
      }
      .footer .pkg { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      @media screen {
        body { padding: 12px; background: #f1f5f9; }
        .label { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div>
        <div class="locker-no">${safeText(lockerId)}</div>
        <div class="safe-line">${safeText(safeName)}</div>
      </div>
      <div class="qr">${qrSvg}</div>
      <div class="footer">
        <div>${safeText(customerName)}</div>
        <div class="pkg">${safeText(loanId)} &middot; ${safeText(packageId)}</div>
      </div>
    </div>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.focus(); window.print(); }, 50);
      });
    </script>
  </body>
</html>`;

  const w = window.open("", "_blank", "width=420,height=520");
  if (!w) {
    toast.error("Popup blocked — allow popups for this site to print labels.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
