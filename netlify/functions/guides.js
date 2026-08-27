import { GUIDES } from "./_response_guides.js";
import { json } from "./_shared.js";

// 시뮬레이션 화면의 "응대 참고" 패널이 쓰는 조각을 그대로 내려줍니다.
// 12개뿐이라 서버에서 걸러 보내는 대신 전부 보내고, 어떤 조각을 보여줄지는
// 클라이언트가 현재 학부모 유형·난이도에 맞춰 고릅니다.
export default async () => json({ guides: GUIDES });

export const config = {
  path: "/api/guides",
  method: ["GET"]
};
