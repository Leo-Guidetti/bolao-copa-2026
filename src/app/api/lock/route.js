import { getSquadLock, getKoWindow } from "@/lib/locks";
export const dynamic = "force-dynamic";
export async function GET() {
  const lock = await getSquadLock();
  const ko = await getKoWindow();
  return Response.json({ ...lock, ko });
}
