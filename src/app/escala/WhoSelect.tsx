"use client";
import { useRouter } from "next/navigation";

export default function WhoSelect({ month, value, people, edit }: { month: string; value: string; edit?: boolean; people: { id: number; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="f who">
      Ver escala de
      <select value={value} onChange={(e) => router.push(`/escala?m=${month}${e.target.value ? `&p=${e.target.value}` : ""}${edit ? "&edit=1" : ""}`)}>
        <option value="">Toda a equipe</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}
