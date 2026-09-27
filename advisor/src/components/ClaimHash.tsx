"use client";
import { useEffect } from "react";

// Do next links to /recovery#claim; open the refund form when that is where the reader landed.
export function ClaimHash() {
  useEffect(() => {
    const open = () => { if (window.location.hash === "#claim") document.getElementById("claim-form")?.setAttribute("open", ""); };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
