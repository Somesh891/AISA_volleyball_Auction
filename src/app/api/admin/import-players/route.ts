
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase URL or service role key in .env.local");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getValue(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const key = Object.keys(row).find(
      (item) => normalizeHeader(item) === normalizeHeader(name)
    );

    if (key && row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }

  return "";
}

function normalizeGender(value: string): "boys" | "girls" | null {
  const gender = value.trim().toLowerCase();

  if (["m", "male", "boy", "boys"].includes(gender)) return "boys";
  if (["f", "female", "girl", "girls"].includes(gender)) return "girls";

  return null;
}

function makeSourceKey(prn: string) {
  const secret =
    process.env.IMPORT_HASH_SECRET ||
    process.env.ADMIN_IMPORT_SECRET;

  if (!secret) {
    throw new Error("Missing import hash secret.");
  }

  return createHmac("sha256", secret)
    .update(prn.toUpperCase().replace(/\s+/g, ""))
    .digest("hex");
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  const provided = request.headers.get("x-admin-secret");

  if (!expected || !provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Check your admin secret." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an Excel file." },
        { status: 400 }
      );
    }

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Upload an .xlsx, .xls, or .csv file." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!firstSheet) {
      return NextResponse.json(
        { error: "No worksheet found in this file." },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      firstSheet,
      {
        defval: "",
        raw: false,
      }
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The worksheet has no player records." },
        { status: 400 }
      );
    }

    const prepared: Record<string, unknown>[] = [];
    const seenPRNs = new Set<string>();

    const duplicateInFile = { boys: 0, girls: 0 };
    const invalidRows = {
      boys: 0,
      girls: 0,
      unknownGender: 0,
    };

    for (const row of rows) {
      const gender = normalizeGender(
        getValue(row, ["Gender"])
      );

      if (!gender) {
        invalidRows.unknownGender++;
        continue;
      }

      const name = getValue(row, ["Full Name", "player_name", "Name"]);
      const prn = getValue(row, ["PRN", "Permanent Registration Number"]);
      const branch = getValue(row, ["Branch"]);
      const academicYear = getValue(row, [
        "Current Year",
        "Academic Year",
        "academic_year",
      ]);

      const preferredPosition = getValue(row, [
        "Prefered Playing Postion",
        "Preferred Playing Position",
        "Preferred Position",
        "preferred_position",
      ]);

      const photoUrl = getValue(row, [
        "Upload Your Photograph",
        "Photo URL",
        "photo_url",
      ]);

      if (!name || !prn || !branch || !academicYear) {
        invalidRows[gender]++;
        continue;
      }

      const normalizedPRN = prn.toUpperCase().replace(/\s+/g, "");

      if (seenPRNs.has(normalizedPRN)) {
        duplicateInFile[gender]++;
        continue;
      }

      seenPRNs.add(normalizedPRN);

      prepared.push({
        gender,
        source_key: makeSourceKey(normalizedPRN),
        name,
        branch,
        academic_year: academicYear,
        preferred_position: preferredPosition || null,
        photo_url: photoUrl || null,
        status: "available",
      });
    }

    if (prepared.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid player records found. Check that the Excel file contains Gender, Full Name, PRN, Branch and Current Year columns.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: auctions, error: auctionError } = await supabase
      .from("auctions")
      .select("id, gender")
      .in("gender", ["boys", "girls"]);

    if (auctionError) throw auctionError;

    const auctionByGender = new Map(
      (auctions ?? []).map((auction) => [auction.gender, auction.id])
    );

    const result = {
      boys: {
        imported: 0,
        alreadyPresent: 0,
        duplicateInFile: duplicateInFile.boys,
        invalid: invalidRows.boys,
      },
      girls: {
        imported: 0,
        alreadyPresent: 0,
        duplicateInFile: duplicateInFile.girls,
        invalid: invalidRows.girls,
      },
      unknownGenderRows: invalidRows.unknownGender,
    };

    for (const gender of ["boys", "girls"] as const) {
      const auctionId = auctionByGender.get(gender);

      if (!auctionId) {
        throw new Error(`Could not find the ${gender} auction in Supabase.`);
      }

      const genderRows = prepared.filter(
        (player) => player.gender === gender
      );

      const keys = genderRows.map(
        (player) => player.source_key as string
      );

      const existingKeys = new Set<string>();

      for (let i = 0; i < keys.length; i += 500) {
        const batch = keys.slice(i, i + 500);

        if (batch.length === 0) continue;

        const { data, error } = await supabase
          .from("players")
          .select("source_key")
          .eq("auction_id", auctionId)
          .in("source_key", batch);

        if (error) throw error;

        for (const player of data ?? []) {
          if (player.source_key) {
            existingKeys.add(player.source_key);
          }
        }
      }

      const newPlayers = genderRows
        .filter(
          (player) => !existingKeys.has(player.source_key as string)
        )
        .map(({ gender: _gender, ...player }) => ({
          ...player,
          auction_id: auctionId,
        }));

      result[gender].alreadyPresent =
        genderRows.length - newPlayers.length;

      for (let i = 0; i < newPlayers.length; i += 100) {
        const batch = newPlayers.slice(i, i + 100);

        const { error } = await supabase
          .from("players")
          .insert(batch);

        if (error) {
          throw new Error(
            `Failed importing ${gender} players: ${error.message}`
          );
        }

        result[gender].imported += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Player import completed.",
      result,
    });
  } catch (error) {
    console.error("Player import error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected import error occurred.",
      },
      { status: 500 }
    );
  }
}
