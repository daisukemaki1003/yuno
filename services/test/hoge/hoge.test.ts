import { hoge } from "@/hoge/index.js";

test("check", () => {
  const hogehoge = hoge();
  expect(hogehoge).toBe("hogehoge");
});
