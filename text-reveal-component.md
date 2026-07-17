# Text Slide Reveal 컴포넌트 스펙

`02.mp4` 영상 분석 기반. 마스크(overflow: hidden) 안에서 텍스트 블록 전체가 아래에서
위로 슬라이드업하며 프레임 안으로 들어오는 효과. 글자 단위/단어 단위 스태거가 아니라
하나의 통짜 블록이 한 번에 움직이는 것이 핵심이며, 이 프로젝트의 기존 히어로 타이틀
(글자 단위 reveal)과는 다른 계열의 컴포넌트다.

## 등장 시퀀스 (2단계)

| 단계 | 시점 | 상태 |
|---|---|---|
| Stage 0 (대기) | 0.0s | 텍스트 블록이 컨테이너 하단 마스크 바깥쪽에 걸쳐 있어 윗부분만 살짝 노출 |
| Stage 1 (슬라이드업) | 0.0s → 0.5s 미만 | 블록 전체가 Y축으로 급상승해 중앙에 정착, 도착 직전 급감속 |

## 속성 변화

| 속성 | 값 |
|---|---|
| Position | Y축만 이동(하단 → 0), X축 이동 없음 |
| Opacity | 페이드인 없음, 마스크에 가려졌다가 그대로 드러나는 방식 |
| Scale | 변화 없음(처음부터 끝까지 고정 크기) |
| Blur | 이동 중 미세한 모션 블러 적용, 정착 시 블러 제거 |
| Rotation | 없음 |

## 이징

`ease-out` 계열(예: `power3.out`, `power4.out`). 초반은 매우 빠르게 튀어 오르고 목적지
도달 직전에 급격히 감속하며 딱 멈추는 느낌 — 필름 프레임이 한 칸 넘어가서 고정되는
듯한 기계적인 인상.

## 애니메이션 단위

글자/단어 단위 스태거 없음. 상단 서브텍스트, 메인 3줄 타이틀, 하단 텍스트가 각각
(혹은 전체가) 하나의 그룹으로 묶여 동일 속도로 동시에 이동한다.

## 배경 상호작용

텍스트가 올라오는 동안 배경의 라이트 리크/스포트라이트도 미세하게 아래로 이동해,
카메라가 아래에서 위로 틸트업하는 듯한 입체감을 만든다. 전체적으로 필름 그레인
텍스처가 깔려 있어 이 프로젝트의 기존 `.grain` 오버레이와 궁합이 좋다.

## 색상 / 타이포그래피

- 색상 — 순수 화이트(#FFFFFF) 텍스트, 어두운 배경과 고대비
- 메인 타이틀 — 굵은 산세리프(Helvetica Black/Montserrat 계열), 자간 좁음
- 서브 텍스트(한자/국문) — 더 얇은 고딕 계열로 위계 구분

## 구현 (GSAP)

기존 `.hero__title`의 글자 단위 char reveal과는 별개 패턴이라 새 클래스
(`.reveal-block`)로 분리한다. `js/main.js`의 다른 IIFE들과 동일하게
가드-등록-트윈 순서를 따른다.

### HTML

```html
<div class="reveal-block">
  <div class="reveal-block__inner">ARCHIVE OF<br>THE SELECTED<br>BY NUDOT</div>
</div>
```

### CSS

```css
.reveal-block {
  overflow: hidden; /* 마스크 — inner가 이 밖으로 나가면 잘려 보인다 */
}
```

### JS (`js/main.js`에 이어 붙일 IIFE)

```js
(function () {
  var blocks = document.querySelectorAll('.reveal-block__inner');
  if (!blocks.length) return;

  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return; // CSS 기본 상태(yPercent 0)가 이미 정적 폴백
  }

  gsap.registerPlugin(ScrollTrigger);

  blocks.forEach(function (el) {
    gsap.fromTo(el,
      { yPercent: 100, filter: 'blur(6px)' },
      {
        yPercent: 0,
        filter: 'blur(0px)',
        duration: 0.45,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none' // 1회성 진입 애니메이션, scrub 아님
        }
      }
    );
  });
})();
```

`scrollTrigger`의 `trigger`는 실제로 어느 섹션에 적용할지에 따라 조정 —
현재는 `.reveal-block__inner` 자기 자신을 트리거로 써서 뷰포트 85% 지점에
들어오면 한 번만 재생되도록 했다. `reveal-block__inner`이 여러 개면
`forEach`로 각각 독립된 트리거를 건다.
