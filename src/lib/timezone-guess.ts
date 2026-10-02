/** Best-effort destination → IANA zone so most users never touch the time-zone field. */
const RULES: Array<[RegExp, string]> = [
  [/도쿄|오사카|교토|후쿠오카|삿포로|오키나와|나고야|요코하마|고베|나라|하코네|일본|tokyo|osaka|kyoto|fukuoka|sapporo|okinawa|japan/i, "Asia/Tokyo"],
  [/서울|부산|제주|강릉|경주|여수|전주|속초|인천|대구|한국|seoul|busan|jeju|korea/i, "Asia/Seoul"],
  [/타이베이|가오슝|타이중|대만|taipei|taiwan/i, "Asia/Taipei"],
  [/홍콩|마카오|hong ?kong|macau/i, "Asia/Hong_Kong"],
  [/상하이|베이징|칭다오|중국|shanghai|beijing|china/i, "Asia/Shanghai"],
  [/싱가포르|singapore/i, "Asia/Singapore"],
  [/방콕|치앙마이|푸켓|태국|bangkok|chiang ?mai|phuket|thailand/i, "Asia/Bangkok"],
  [/다낭|호찌민|호치민|하노이|나트랑|푸꾸옥|베트남|da ?nang|ho ?chi ?minh|hanoi|vietnam/i, "Asia/Ho_Chi_Minh"],
  [/세부|마닐라|보라카이|필리핀|cebu|manila|boracay|philippines/i, "Asia/Manila"],
  [/발리|bali/i, "Asia/Makassar"],
  [/괌|사이판|guam|saipan/i, "Pacific/Guam"],
  [/시드니|멜버른|호주|sydney|melbourne|australia/i, "Australia/Sydney"],
  [/런던|영국|london/i, "Europe/London"],
  [/파리|로마|바르셀로나|마드리드|베를린|프라하|빈|암스테르담|밀라노|피렌체|베네치아|취리히|프랑스|이탈리아|스페인|독일|paris|rome|barcelona|berlin|prague|vienna/i, "Europe/Paris"],
  [/뉴욕|보스턴|워싱턴|new ?york|boston/i, "America/New_York"],
  [/로스앤젤레스|LA|샌프란시스코|라스베이거스|시애틀|los ?angeles|san ?francisco|las ?vegas|seattle/i, "America/Los_Angeles"],
  [/하와이|호놀룰루|hawaii|honolulu/i, "Pacific/Honolulu"],
];

export function guessTimeZone(destination: string): string | null {
  const text = destination.trim();
  if (!text) return null;
  for (const [pattern, zone] of RULES) if (pattern.test(text)) return zone;
  return null;
}
