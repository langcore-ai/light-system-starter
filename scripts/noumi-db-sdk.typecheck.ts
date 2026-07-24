import {
	createNoumiDatabase,
	type NoumiDbTransport,
} from "./noumi-db-sdk";

/** 普通业务 interface 不需要字符串 index signature。 */
interface Board {
	id: string;
	name: string;
	position: number;
	archived: boolean;
}

/** 该文件只由 tsc 编译，用于锁定公开 builder 的合法状态跳转。 */
declare const transport: NoumiDbTransport;
const db = createNoumiDatabase(transport);

db.from<Board>("boards").select("id,name").eq("id", "board-1").single();
db.from<Board>("boards").insert({ id: "board-1", name: "Roadmap" });
db.from<Board>("boards").update({ name: "Updated" }).eq("id", "board-1");
db.from<Board>("boards").delete().all();

const unsafeUpdate = db.from<Board>("boards").update({ name: "Unsafe" });
// @ts-expect-error 未完成 filter/all guard 时不能执行 mutation。
unsafeUpdate.execute();
// @ts-expect-error 未完成 filter/all guard 时不能选择 returning。
unsafeUpdate.select("*");
// @ts-expect-error all() 已结束 mutation scope，不能再追加 filter。
db.from<Board>("boards").delete().all().eq("id", "board-1");
// @ts-expect-error in() 不接受 null；NULL predicate 必须使用 is()。
db.from<Board>("boards").select("*").in("id", ["board-1", null]);
// @ts-expect-error terminal cardinality builder 不能继续追加 filter。
db.from<Board>("boards").select("*").single().eq("id", "board-1");
