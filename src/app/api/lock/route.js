import { getSquadLock } from "@/lib/locks";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await getSquadLock());
}
