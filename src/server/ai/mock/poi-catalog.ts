import "server-only";
import type { PlaceCategory } from "@/generated/prisma/enums";
import { referenceRate } from "@/lib/fx";

/**
 * Curated points of interest for the deterministic mock planner and companion.
 * Costs are per person in the city's local currency; coordinates are approximate.
 */
export interface Poi {
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  minutes: number;
  cost: number;
  indoor: boolean;
  address: string;
  tags?: string[];
}

export interface City {
  key: string;
  match: RegExp;
  currency: string;
  center: { lat: number; lng: number };
  airport?: Poi;
  pois: Poi[];
}

const p = (
  name: string,
  category: PlaceCategory,
  lat: number,
  lng: number,
  minutes: number,
  cost: number,
  indoor: boolean,
  address: string,
  tags?: string[],
): Poi => ({ name, category, lat, lng, minutes, cost, indoor, address, tags });

export const CITIES: City[] = [
  {
    key: "tokyo",
    match: /도쿄|동경|tokyo/i,
    currency: "JPY",
    center: { lat: 35.6812, lng: 139.7671 },
    airport: p("하네다 공항", "AIRPORT", 35.5494, 139.7798, 60, 0, true, "Haneda Airport, Ota City"),
    pois: [
      p("아사쿠사 센소지", "CULTURE", 35.7148, 139.7967, 90, 0, false, "2-3-1 Asakusa, Taito City"),
      p("나카미세 거리", "SHOPPING", 35.7119, 139.7965, 45, 1000, false, "Asakusa, Taito City"),
      p("도쿄 스카이트리", "SIGHTSEEING", 35.7101, 139.8107, 90, 3100, true, "1-1-2 Oshiage, Sumida City", ["view"]),
      p("우에노 공원", "NATURE", 35.7156, 139.7745, 75, 0, false, "Uenokoen, Taito City"),
      p("아메요코 시장", "SHOPPING", 35.7101, 139.7745, 60, 1500, false, "Ueno, Taito City"),
      p("시부야 스크램블 교차로", "SIGHTSEEING", 35.6595, 139.7005, 30, 0, false, "Shibuya City"),
      p("시부야 스카이", "SIGHTSEEING", 35.6585, 139.7022, 75, 2500, false, "2-24-12 Shibuya", ["view"]),
      p("메이지 신궁", "CULTURE", 35.6764, 139.6993, 75, 0, false, "1-1 Yoyogikamizonocho, Shibuya City"),
      p("다케시타 거리", "SHOPPING", 35.6716, 139.7031, 60, 1500, false, "Jingumae, Shibuya City"),
      p("오모테산도 힐즈", "SHOPPING", 35.6672, 139.7085, 75, 2000, true, "4-12-10 Jingumae, Shibuya City"),
      p("팀랩 플래닛", "CULTURE", 35.6491, 139.7898, 120, 3800, true, "6-1-16 Toyosu, Koto City", ["photo"]),
      p("도쿄 국립박물관", "CULTURE", 35.7188, 139.7765, 120, 1000, true, "13-9 Uenokoen, Taito City"),
      p("츠키지 장외시장", "FOOD", 35.6654, 139.7707, 75, 3000, false, "4 Tsukiji, Chuo City", ["seafood"]),
      p("긴자 거리", "SHOPPING", 35.6717, 139.765, 90, 3000, false, "Ginza, Chuo City"),
      p("오다이바 해변공원", "NATURE", 35.6298, 139.7745, 60, 0, false, "1-4 Daiba, Minato City"),
      p("도쿄 타워", "SIGHTSEEING", 35.6586, 139.7454, 60, 1500, false, "4-2-8 Shibakoen, Minato City", ["view"]),
      p("신주쿠 교엔", "NATURE", 35.6852, 139.71, 75, 500, false, "11 Naitomachi, Shinjuku City"),
      p("이치란 라멘 시부야", "FOOD", 35.6614, 139.7005, 50, 1400, true, "1-22-7 Jinnan, Shibuya City", ["ramen", "라멘"]),
      p("후쿠로쿠 라멘", "FOOD", 35.7134, 139.7937, 50, 1200, true, "Asakusa, Taito City", ["ramen", "라멘"]),
      p("텐동 마사루", "FOOD", 35.7127, 139.7962, 60, 2000, true, "1-32-2 Asakusa, Taito City"),
      p("스시 잔마이 츠키지", "FOOD", 35.6655, 139.7703, 60, 3500, true, "4-11-9 Tsukiji, Chuo City", ["sushi", "스시"]),
      p("오모이데 요코초 야키토리", "FOOD", 35.6933, 139.6994, 90, 3500, true, "1-2 Nishishinjuku, Shinjuku City", ["izakaya", "이자카야"]),
      p("규카츠 모토무라 시부야", "FOOD", 35.6597, 139.6985, 50, 1800, true, "3-18-10 Shibuya", ["규카츠"]),
      p("푸글렌 도쿄", "CAFE", 35.6668, 139.6927, 50, 900, true, "1-16-11 Tomigaya, Shibuya City"),
      p("블루보틀 기요스미", "CAFE", 35.6804, 139.8016, 45, 800, true, "1-4-8 Hirano, Koto City"),
      p("오니버스 커피 나카메구로", "CAFE", 35.6448, 139.6987, 45, 700, true, "2-14-1 Kamimeguro, Meguro City"),
    ],
  },
  {
    key: "osaka",
    match: /오사카|osaka/i,
    currency: "JPY",
    center: { lat: 34.6937, lng: 135.5023 },
    airport: p("간사이 국제공항", "AIRPORT", 34.4347, 135.244, 60, 0, true, "Kansai International Airport"),
    pois: [
      p("오사카성", "CULTURE", 34.6873, 135.5262, 90, 600, false, "1-1 Osakajo, Chuo Ward"),
      p("도톤보리", "SIGHTSEEING", 34.6687, 135.5013, 60, 0, false, "Dotonbori, Chuo Ward"),
      p("구로몬 시장", "FOOD", 34.6655, 135.5068, 60, 2500, false, "2-4-1 Nipponbashi, Chuo Ward", ["seafood"]),
      p("신세카이 츠텐카쿠", "SIGHTSEEING", 34.6525, 135.5063, 60, 900, false, "1-18-6 Ebisuhigashi, Naniwa Ward", ["view"]),
      p("우메다 공중정원", "SIGHTSEEING", 34.7053, 135.4896, 60, 1500, true, "1-1-88 Oyodonaka, Kita Ward", ["view"]),
      p("유니버설 스튜디오 재팬", "ACTIVITY", 34.6654, 135.4323, 420, 9800, false, "2-1-33 Sakurajima, Konohana Ward"),
      p("가이유칸 수족관", "ACTIVITY", 34.6545, 135.429, 120, 2700, true, "1-1-10 Kaigandori, Minato Ward"),
      p("신사이바시 쇼핑거리", "SHOPPING", 34.6743, 135.5011, 90, 3000, true, "Shinsaibashisuji, Chuo Ward"),
      p("나카노시마 공원", "NATURE", 34.6929, 135.5081, 45, 0, false, "Nakanoshima, Kita Ward"),
      p("쿠쿠루 타코야키", "FOOD", 34.6688, 135.5028, 30, 800, false, "1-10-5 Dotonbori, Chuo Ward", ["타코야키"]),
      p("미즈노 오코노미야키", "FOOD", 34.6686, 135.5011, 60, 1800, true, "1-4-15 Dotonbori, Chuo Ward"),
      p("쿠시카츠 다루마 신세카이", "FOOD", 34.6522, 135.5059, 60, 2500, true, "2-3-9 Ebisuhigashi, Naniwa Ward"),
      p("이치란 라멘 도톤보리", "FOOD", 34.6688, 135.5016, 50, 1200, true, "Dotonbori, Chuo Ward", ["ramen", "라멘"]),
      p("릴로 커피 로스터스", "CAFE", 34.6723, 135.4986, 45, 700, true, "1-10-28 Nishishinsaibashi, Chuo Ward"),
    ],
  },
  {
    key: "kyoto",
    match: /교토|kyoto/i,
    currency: "JPY",
    center: { lat: 35.0116, lng: 135.7681 },
    pois: [
      p("후시미 이나리 신사", "CULTURE", 34.9671, 135.7727, 120, 0, false, "68 Fukakusa Yabunouchicho, Fushimi Ward", ["photo"]),
      p("기요미즈데라", "CULTURE", 34.9949, 135.785, 90, 500, false, "1-294 Kiyomizu, Higashiyama Ward"),
      p("산넨자카·니넨자카", "SHOPPING", 34.9965, 135.7807, 60, 1500, false, "Higashiyama Ward"),
      p("기온 거리", "CULTURE", 35.0037, 135.7751, 60, 0, false, "Gion, Higashiyama Ward"),
      p("아라시야마 대나무숲", "NATURE", 35.017, 135.6713, 60, 0, false, "Sagaogurayama, Ukyo Ward", ["photo"]),
      p("긴카쿠지", "CULTURE", 35.0394, 135.7292, 60, 500, false, "1 Kinkakujicho, Kita Ward"),
      p("니시키 시장", "FOOD", 35.005, 135.7649, 60, 2000, true, "Nishikikoji-dori, Nakagyo Ward"),
      p("철학의 길", "NATURE", 35.0236, 135.7944, 60, 0, false, "Sakyo Ward"),
      p("% 아라비카 아라시야마", "CAFE", 35.0137, 135.6773, 30, 600, false, "Sagatenryuji, Ukyo Ward"),
      p("이노다 커피 본점", "CAFE", 35.0082, 135.7618, 45, 900, true, "140 Doyucho, Nakagyo Ward"),
      p("교토 우동 오멘", "FOOD", 35.0261, 135.7942, 50, 1300, true, "74 Jodoji Ishibashicho, Sakyo Ward"),
      p("폰토초 저녁", "FOOD", 35.0049, 135.7712, 90, 4000, true, "Pontocho, Nakagyo Ward", ["izakaya"]),
    ],
  },
  {
    key: "fukuoka",
    match: /후쿠오카|fukuoka|하카타/i,
    currency: "JPY",
    center: { lat: 33.5902, lng: 130.4017 },
    airport: p("후쿠오카 공항", "AIRPORT", 33.5859, 130.4511, 45, 0, true, "Fukuoka Airport"),
    pois: [
      p("오호리 공원", "NATURE", 33.5862, 130.3763, 60, 0, false, "1-2 Ohorikoen, Chuo Ward"),
      p("캐널시티 하카타", "SHOPPING", 33.5898, 130.4111, 90, 3000, true, "1-2 Sumiyoshi, Hakata Ward"),
      p("구시다 신사", "CULTURE", 33.5931, 130.4106, 40, 0, false, "1-41 Kamikawabatamachi, Hakata Ward"),
      p("후쿠오카 타워", "SIGHTSEEING", 33.5933, 130.3515, 60, 800, true, "2-3-26 Momochihama, Sawara Ward", ["view"]),
      p("다자이후 텐만구", "CULTURE", 33.5215, 130.5349, 120, 0, false, "4-7-1 Saifu, Dazaifu"),
      p("텐진 지하상가", "SHOPPING", 33.5911, 130.3988, 60, 2000, true, "Tenjin, Chuo Ward"),
      p("나카스 야타이", "FOOD", 33.5925, 130.4044, 90, 2500, false, "Nakasu, Hakata Ward", ["izakaya"]),
      p("하카타 잇코샤 라멘", "FOOD", 33.5897, 130.4207, 40, 1000, true, "Hakata Station", ["ramen", "라멘"]),
      p("모츠나베 라쿠텐치", "FOOD", 33.5918, 130.3987, 75, 2500, true, "Tenjin, Chuo Ward"),
      p("커넥트 커피", "CAFE", 33.5884, 130.3957, 40, 700, true, "Daimyo, Chuo Ward"),
    ],
  },
  {
    key: "seoul",
    match: /서울|seoul/i,
    currency: "KRW",
    center: { lat: 37.5665, lng: 126.978 },
    pois: [
      p("경복궁", "CULTURE", 37.5796, 126.977, 90, 3000, false, "서울 종로구 사직로 161"),
      p("북촌 한옥마을", "CULTURE", 37.5826, 126.9831, 75, 0, false, "서울 종로구 계동길 37", ["photo"]),
      p("익선동 골목", "CAFE", 37.5744, 126.9897, 60, 7000, false, "서울 종로구 익선동"),
      p("광장시장", "FOOD", 37.5701, 126.9996, 60, 15000, true, "서울 종로구 창경궁로 88"),
      p("N서울타워", "SIGHTSEEING", 37.5512, 126.9882, 75, 21000, false, "서울 용산구 남산공원길 105", ["view"]),
      p("명동 거리", "SHOPPING", 37.5636, 126.9826, 90, 30000, false, "서울 중구 명동"),
      p("성수동 카페거리", "CAFE", 37.5446, 127.0557, 75, 9000, true, "서울 성동구 성수동"),
      p("서울숲", "NATURE", 37.5444, 127.0374, 60, 0, false, "서울 성동구 뚝섬로 273"),
      p("한강공원 여의도", "NATURE", 37.5284, 126.9346, 60, 0, false, "서울 영등포구 여의동로 330"),
      p("더현대 서울", "SHOPPING", 37.5259, 126.9284, 90, 30000, true, "서울 영등포구 여의대로 108"),
      p("국립중앙박물관", "CULTURE", 37.5239, 126.9803, 120, 0, true, "서울 용산구 서빙고로 137"),
      p("을지로 노포 골목", "FOOD", 37.566, 126.991, 90, 25000, true, "서울 중구 을지로", ["izakaya"]),
      p("토속촌 삼계탕", "FOOD", 37.5779, 126.9714, 60, 20000, true, "서울 종로구 자하문로5길 5"),
      p("망원시장", "FOOD", 37.5559, 126.9064, 60, 12000, false, "서울 마포구 포은로8길 14"),
    ],
  },
  {
    key: "busan",
    match: /부산|busan|해운대/i,
    currency: "KRW",
    center: { lat: 35.1796, lng: 129.0756 },
    pois: [
      p("해운대 해수욕장", "NATURE", 35.1587, 129.1604, 75, 0, false, "부산 해운대구 해운대해변로 264"),
      p("해운대 블루라인파크", "ACTIVITY", 35.1608, 129.1712, 75, 13000, false, "부산 해운대구 달맞이길62번길 13", ["view"]),
      p("감천문화마을", "CULTURE", 35.0975, 129.0106, 90, 0, false, "부산 사하구 감내2로 203", ["photo"]),
      p("자갈치시장", "FOOD", 35.0966, 129.0306, 60, 30000, true, "부산 중구 자갈치해안로 52", ["seafood"]),
      p("BIFF 광장", "FOOD", 35.0984, 129.0279, 45, 8000, false, "부산 중구 비프광장로"),
      p("광안리 해수욕장", "NATURE", 35.1532, 129.1186, 60, 0, false, "부산 수영구 광안해변로 219"),
      p("해동용궁사", "CULTURE", 35.1884, 129.2233, 60, 0, false, "부산 기장군 기장읍 용궁길 86"),
      p("흰여울문화마을", "CULTURE", 35.0789, 129.0446, 60, 0, false, "부산 영도구 영선동4가"),
      p("돼지국밥 골목", "FOOD", 35.1379, 129.0584, 45, 10000, true, "부산 남구 대연동"),
      p("전포 카페거리", "CAFE", 35.1556, 129.0646, 60, 8000, true, "부산 부산진구 전포대로"),
    ],
  },
  {
    key: "jeju",
    match: /제주|jeju/i,
    currency: "KRW",
    center: { lat: 33.4996, lng: 126.5312 },
    airport: p("제주국제공항", "AIRPORT", 33.5104, 126.4914, 45, 0, true, "제주 제주시 공항로 2"),
    pois: [
      p("성산일출봉", "NATURE", 33.4581, 126.9425, 90, 5000, false, "제주 서귀포시 성산읍 일출로 284-12", ["view"]),
      p("우도", "NATURE", 33.5065, 126.9531, 180, 15000, false, "제주 제주시 우도면"),
      p("섭지코지", "NATURE", 33.4245, 126.9309, 60, 0, false, "제주 서귀포시 성산읍 섭지코지로 107"),
      p("협재 해수욕장", "NATURE", 33.3943, 126.2396, 75, 0, false, "제주 제주시 한림읍 협재리"),
      p("오설록 티뮤지엄", "CAFE", 33.3058, 126.2896, 60, 8000, true, "제주 서귀포시 안덕면 신화역사로 15"),
      p("카멜리아힐", "NATURE", 33.2895, 126.3684, 90, 10000, false, "제주 서귀포시 안덕면 병악로 166", ["photo"]),
      p("아르떼뮤지엄 제주", "CULTURE", 33.3966, 126.3448, 90, 17000, true, "제주 제주시 애월읍 어림비로 478", ["photo"]),
      p("동문시장", "FOOD", 33.512, 126.5283, 60, 15000, true, "제주 제주시 관덕로14길 20"),
      p("애월 카페거리", "CAFE", 33.4636, 126.3094, 60, 9000, true, "제주 제주시 애월읍 애월해안로"),
      p("흑돼지 거리", "FOOD", 33.5138, 126.5236, 75, 30000, true, "제주 제주시 관덕로15길"),
      p("천지연 폭포", "NATURE", 33.2469, 126.5543, 45, 2000, false, "제주 서귀포시 남성중로 2-15"),
      p("올레시장 서귀포", "FOOD", 33.2501, 126.5636, 60, 12000, true, "제주 서귀포시 중앙로62번길 18"),
    ],
  },
  {
    key: "taipei",
    match: /타이베이|대만|taipei|taiwan/i,
    currency: "TWD",
    center: { lat: 25.033, lng: 121.5654 },
    pois: [
      p("타이베이 101 전망대", "SIGHTSEEING", 25.0339, 121.5645, 75, 600, true, "No. 7 Xinyi Rd, Sec. 5", ["view"]),
      p("국립고궁박물원", "CULTURE", 25.1024, 121.5485, 150, 350, true, "No. 221 Zhishan Rd, Sec. 2"),
      p("용산사", "CULTURE", 25.0372, 121.4999, 45, 0, false, "No. 211 Guangzhou St, Wanhua"),
      p("시먼딩", "SHOPPING", 25.0422, 121.5075, 90, 500, false, "Ximending, Wanhua"),
      p("스린 야시장", "FOOD", 25.0878, 121.5241, 90, 400, false, "No. 101 Jihe Rd, Shilin", ["night"]),
      p("딘타이펑 본점", "FOOD", 25.0336, 121.5299, 60, 600, true, "No. 194 Xinyi Rd, Sec. 2"),
      p("융캉제", "FOOD", 25.0322, 121.5297, 75, 300, false, "Yongkang St, Da'an"),
      p("코끼리산 하이킹", "NATURE", 25.0271, 121.5765, 90, 0, false, "Xiangshan, Xinyi", ["view"]),
      p("화산1914 문화창의산업원구", "CULTURE", 25.0441, 121.5293, 60, 0, false, "No. 1 Bade Rd, Sec. 1"),
      p("심플 카파", "CAFE", 25.0444, 121.5296, 45, 180, true, "Huashan 1914"),
    ],
  },
  {
    key: "bangkok",
    match: /방콕|bangkok/i,
    currency: "THB",
    center: { lat: 13.7563, lng: 100.5018 },
    pois: [
      p("왓 프라깨우 & 왕궁", "CULTURE", 13.75, 100.4913, 120, 500, false, "Na Phra Lan Rd, Phra Nakhon"),
      p("왓 아룬", "CULTURE", 13.7437, 100.4889, 60, 100, false, "158 Thanon Wang Doem"),
      p("왓 포", "CULTURE", 13.7465, 100.4927, 60, 300, false, "2 Sanam Chai Rd"),
      p("짜뚜짝 주말시장", "SHOPPING", 13.7999, 100.5502, 150, 800, false, "Kamphaeng Phet 2 Rd, Chatuchak"),
      p("아이콘시암", "SHOPPING", 13.7266, 100.5104, 120, 1000, true, "299 Charoen Nakhon Rd", ["mall"]),
      p("카오산 로드", "SIGHTSEEING", 13.7589, 100.4974, 60, 300, false, "Khaosan Rd, Talat Yot"),
      p("룸피니 공원", "NATURE", 13.7314, 100.5414, 60, 0, false, "Rama IV Rd, Pathum Wan"),
      p("팁싸마이 팟타이", "FOOD", 13.7527, 100.5049, 45, 150, true, "313 Maha Chai Rd"),
      p("짜이 화이 크랩 커리", "FOOD", 13.7383, 100.5612, 60, 600, true, "Sukhumvit Soi 33"),
      p("마하나콘 스카이워크", "SIGHTSEEING", 13.7234, 100.528, 75, 900, false, "114 Narathiwat Rd", ["view"]),
    ],
  },
  {
    key: "danang",
    match: /다낭|da ?nang|호이안|hoi ?an/i,
    currency: "VND",
    center: { lat: 16.0544, lng: 108.2022 },
    pois: [
      p("미케 비치", "NATURE", 16.0544, 108.2478, 90, 0, false, "Võ Nguyên Giáp, Sơn Trà"),
      p("바나힐 골든브릿지", "ACTIVITY", 15.995, 107.9963, 300, 900000, false, "Hòa Ninh, Hòa Vang", ["photo"]),
      p("호이안 올드타운", "CULTURE", 15.8801, 108.338, 150, 120000, false, "Hội An, Quảng Nam", ["night"]),
      p("오행산", "NATURE", 16.0034, 108.2638, 90, 40000, false, "Hòa Hải, Ngũ Hành Sơn"),
      p("린응사", "CULTURE", 16.1003, 108.2779, 60, 0, false, "Hoàng Sa, Sơn Trà"),
      p("한 시장", "SHOPPING", 16.0681, 108.2245, 60, 200000, true, "119 Trần Phú, Hải Châu"),
      p("미꽝 1A", "FOOD", 16.0628, 108.2196, 45, 50000, true, "1 Hải Phòng, Hải Châu"),
      p("콩 카페", "CAFE", 16.0688, 108.2237, 45, 60000, true, "96-98 Bạch Đằng, Hải Châu"),
    ],
  },
  {
    key: "paris",
    match: /파리|paris/i,
    currency: "EUR",
    center: { lat: 48.8566, lng: 2.3522 },
    pois: [
      p("에펠탑", "SIGHTSEEING", 48.8584, 2.2945, 120, 29, false, "Champ de Mars, 5 Av. Anatole France", ["view"]),
      p("루브르 박물관", "CULTURE", 48.8606, 2.3376, 180, 22, true, "Rue de Rivoli, 75001"),
      p("오르세 미술관", "CULTURE", 48.86, 2.3266, 150, 16, true, "Esplanade Valéry Giscard d'Estaing"),
      p("몽마르트르 언덕", "CULTURE", 48.8867, 2.3431, 90, 0, false, "35 Rue du Chevalier de la Barre", ["view"]),
      p("노트르담 대성당", "CULTURE", 48.853, 2.3499, 60, 0, false, "6 Parvis Notre-Dame"),
      p("샹젤리제 & 개선문", "SIGHTSEEING", 48.8738, 2.295, 75, 16, false, "Place Charles de Gaulle"),
      p("뤽상부르 공원", "NATURE", 48.8462, 2.3372, 60, 0, false, "75006 Paris"),
      p("마레 지구", "SHOPPING", 48.8575, 2.3622, 90, 40, false, "Le Marais, 75004"),
      p("세느강 유람선", "ACTIVITY", 48.8619, 2.3091, 60, 17, false, "Port de la Conférence"),
      p("르 를레 드 랑트르코트", "FOOD", 48.8539, 2.3325, 75, 35, true, "20 Rue Saint-Benoît"),
      p("카페 드 플로르", "CAFE", 48.8541, 2.3326, 45, 12, true, "172 Bd Saint-Germain"),
      p("뒤 팡 에 데 지데", "CAFE", 48.8714, 2.3632, 30, 8, true, "34 Rue Yves Toudic"),
    ],
  },
];

export function findCity(destination: string): City | undefined {
  return CITIES.find((c) => c.match.test(destination));
}

/** Rough conversion for mock price estimates, rounded to tidy numbers (100 won / 100 yen). */
export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const converted = amount * referenceRate(from, to);
  const rounding = ["KRW", "JPY", "VND"].includes(to) ? 100 : 1;
  return Math.round(converted / rounding) * rounding;
}
