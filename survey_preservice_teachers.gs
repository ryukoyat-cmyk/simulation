/**
 * 예비교원 대상 설문 Google Forms 자동 생성 스크립트 (Google Apps Script)
 *
 * 사용 방법
 *  1. https://script.google.com 에서 [새 프로젝트]를 만든다.
 *  2. 이 파일의 내용을 전부 붙여넣고 저장한다.
 *  3. 아래 CONFIG의 [ ] 부분(연구자 정보, IRB 번호, 보관 기간, 소요 시간)을 채운다.
 *  4. 함수 선택란에서 createSurveyForms를 고르고 [실행]한다. (최초 1회 권한 승인 필요)
 *  5. [실행 로그]에 설문 편집 주소와 응답자용 주소가 출력된다.
 *
 * 생성되는 폼
 *  - 본 설문: 동의 → 응답자 정보 → 리커트(5점) 14문항 → 개방형 3문항
 *  - 면담 참여 의사 폼(별도): 연락처를 본 설문 응답과 분리해 수집하기 위함
 */

const CONFIG = {
  surveyTitle: '학부모 민원 대응 AI 음성 시뮬레이션 프로그램 사용 경험 설문',
  interviewTitle: '후속 면담 참여 의사 확인',
  researcher: '[소속, 성명]',
  contact: '[이메일]',
  irb: '[IRB 승인번호 또는 면제 확인]',
  retentionYears: '[  ]',
  responseMinutes: '[  ]',
};

const SCALE = ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];

const LIKERT_SECTIONS = [
  {
    title: '1. 시스템 사용성',
    rows: [
      '별도의 복잡한 안내 없이도 프로그램의 사용 방법을 쉽게 이해할 수 있었다.',
      '프로그램을 사용하는 과정은 전반적으로 간단하고 편리하였다.',
      '화면에 제시된 정보와 기능을 쉽게 찾고 사용할 수 있었다.',
    ],
  },
  {
    title: '2. 시뮬레이션 실제성 및 상호작용',
    rows: [
      '제시된 학부모 민원 상황은 실제 학교에서 발생할 수 있는 상황처럼 느껴졌다.',
      'AI 학부모는 나의 대응 내용에 따라 맥락에 맞게 반응하였다.',
      '음성으로 AI 학부모와 대화하는 방식은 민원 상황에 몰입하는 데 도움이 되었다.',
    ],
  },
  {
    title: '3. 평가·피드백 유용성',
    rows: [
      '시뮬레이션 종료 후 제공된 평가 결과를 쉽게 이해할 수 있었다.',
      '제공된 피드백은 내가 수행한 실제 대화 내용과 민원 상황에 적절하게 연결되어 있었다.',
      '제시된 대안 발화와 대응 방법은 유사한 민원 상황에서 어떻게 대응해야 할지 생각하는 데 도움이 되었다.',
    ],
  },
  {
    title: '4. 교육적 유용성',
    rows: [
      '이 프로그램은 학부모 민원 상황에서 적절한 대응 방법을 생각하고 나의 대응을 성찰하는 데 도움이 되었다.',
      '이 프로그램은 교사 개인이 대응할 수 있는 범위와 공식적인 절차가 필요한 상황을 구분하여 생각하는 데 도움이 되었다.',
      '이 프로그램은 앞으로 학부모 민원 대응을 준비하는 데 도움이 되었다.',
    ],
  },
  {
    title: '5. 전반적 만족도',
    rows: [
      '전반적으로 이 프로그램을 사용한 경험에 만족한다.',
      '기회가 있다면 다른 학부모 민원 상황도 이 프로그램으로 연습해 보고 싶다.',
    ],
  },
];

const OPEN_ENDED = [
  '프로그램을 사용하면서 가장 도움이 되었던 부분과 그 이유는 무엇입니까?',
  '사용 중 불편했거나 부자연스러웠던 부분은 무엇입니까?',
  '학부모 민원 대응과 관련하여 새롭게 알게 되거나 생각하게 된 점은 무엇입니까?',
];

function createSurveyForms() {
  const interviewForm = buildInterviewForm_();
  const surveyForm = buildSurveyForm_(interviewForm.getPublishedUrl());

  Logger.log('[본 설문] 편집: ' + surveyForm.getEditUrl());
  Logger.log('[본 설문] 응답자용: ' + surveyForm.getPublishedUrl());
  Logger.log('[면담 참여 폼] 편집: ' + interviewForm.getEditUrl());
  Logger.log('[면담 참여 폼] 응답자용: ' + interviewForm.getPublishedUrl());
}

function buildSurveyForm_(interviewUrl) {
  const form = FormApp.create(CONFIG.surveyTitle);
  form.setDescription(
    '안녕하세요.\n\n' +
    '본 설문은 「교원의 학부모 민원 대응 역량 강화를 위한 AI 기반 음성 시뮬레이션 프로그램」(이하 \'시뮬레이션\')을 사용한 후, ' +
    '사용 경험과 교육적 유용성에 대한 인식을 확인하기 위한 연구의 일환으로 실시됩니다. ' +
    '시뮬레이션을 체험하신 뒤 응답해 주시며, 응답 소요 시간은 약 ' + CONFIG.responseMinutes + '분입니다.\n\n' +
    '시뮬레이션 체험은 강의 활동이며, 본 설문에 응답할지 여부는 연구 참여에 해당합니다. ' +
    '설문 참여 여부와 응답 내용은 성적 및 강의 평가와 무관하며, 참여하지 않으셔도 어떠한 불이익도 없습니다. ' +
    '응답 중에는 언제든 중단하실 수 있습니다. 다만 본 설문은 무기명으로 진행되므로 제출 후에는 개별 응답을 찾아 삭제하기 어렵습니다. ' +
    '시뮬레이션에서 다루는 민원 상황으로 불편함을 느끼시면 참여를 중단하셔도 됩니다.\n\n' +
    '성명, 학번, 연락처 등 개인정보는 수집하지 않습니다. 서술형 응답에는 실제 학생, 학부모, 학교를 식별할 수 있는 정보나 실제 민원 사례를 적지 말아 주십시오.\n\n' +
    '수집된 응답은 연구 목적으로만 활용되며, 논문이나 학술발표 등으로 공개할 때 개인을 식별할 수 있는 정보는 공개하지 않습니다. ' +
    '응답 자료는 관련 법령과 소속기관의 연구윤리 기준에 따라 안전하게 관리하며, ' + CONFIG.retentionYears + '년간 보관 후 폐기합니다.\n\n' +
    '연구자: ' + CONFIG.researcher + ' / 문의: ' + CONFIG.contact + '\n' +
    'IRB: ' + CONFIG.irb
  );

  // 설정: 무기명 유지
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    '응답해 주셔서 감사합니다.\n\n' +
    '후속 면담(약 20~30분)에 참여하실 의사가 있으시면 아래 별도 주소에서 연락처를 남겨 주십시오. ' +
    '해당 주소는 본 설문 응답과 연결되지 않으며, 참여는 자발적입니다.\n' + interviewUrl
  );

  // 동의
  const consent = form.addMultipleChoiceItem();
  consent.setTitle('위 내용을 읽고 이해하였으며 연구 참여에 동의합니다.')
    .setRequired(true)
    .setChoices([
      consent.createChoice('예', FormApp.PageNavigationType.CONTINUE),
      consent.createChoice('아니오', FormApp.PageNavigationType.SUBMIT),
    ]);

  // 섹션 1. 응답자 정보
  form.addPageBreakItem()
    .setTitle('섹션 1. 응답자 정보')
    .setHelpText('통계 처리를 위한 정보이며, 개인을 식별하지 않습니다.');

  form.addMultipleChoiceItem()
    .setTitle('학년')
    .setChoiceValues(['1학년', '2학년', '3학년', '4학년'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('교육실습 경험 (해당하는 것을 모두 선택)')
    .setChoiceValues([
      '없음',
      '관찰·참관 실습 경험이 있음',
      '수업 실습(교생 실습) 경험이 있음',
      '학부모 상담이나 응대를 참관하거나 직접 경험한 적이 있음',
    ])
    .setHelpText('경험이 없으면 \'없음\'만 선택해 주십시오.')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('AI·에듀테크 활용 경험 (최근 1년 이내, 학습 또는 실습에서)')
    .setChoiceValues(['활용한 적 없음', '1~5회', '6~20회', '21회 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('시뮬레이션을 사용한 기기')
    .setChoiceValues(['데스크톱 PC', '노트북', '태블릿', '스마트폰'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('음성 입력에 사용한 장치')
    .setChoiceValues(['기기 내장 마이크', '이어폰·헤드셋 마이크', '외장 마이크'])
    .setRequired(true);

  // 섹션 2. 리커트
  form.addPageBreakItem()
    .setTitle('섹션 2. 시뮬레이션 사용 경험과 유용성')
    .setHelpText('시뮬레이션을 체험한 경험을 바탕으로, 각 문항에 해당하는 정도를 선택해 주십시오. ' +
      '(1: 전혀 그렇지 않다 ~ 5: 매우 그렇다)');

  LIKERT_SECTIONS.forEach(function (section, idx) {
    if (idx > 0) {
      form.addPageBreakItem().setTitle('섹션 2. 시뮬레이션 사용 경험과 유용성 (계속)');
    }
    form.addGridItem()
      .setTitle(section.title)
      .setRows(section.rows)
      .setColumns(SCALE)
      .setRequired(true);
  });

  // 섹션 3. 개방형
  form.addPageBreakItem()
    .setTitle('섹션 3. 자유 의견 (선택 응답)')
    .setHelpText('실제 학생, 학부모, 학교를 식별할 수 있는 정보나 실제 민원 사례는 적지 말아 주십시오.');

  OPEN_ENDED.forEach(function (q) {
    form.addParagraphTextItem().setTitle(q).setRequired(false);
  });

  return form;
}

function buildInterviewForm_() {
  const form = FormApp.create(CONFIG.interviewTitle);
  form.setDescription(
    '후속 면담은 시뮬레이션 사용 경험을 더 자세히 듣기 위한 것으로, 약 20~30분 동안 진행되며 녹음 및 전사됩니다. ' +
    '참여는 자발적이며 성적 및 강의 평가와 무관합니다. 면담 참여 의사를 남기셔도 이후 언제든 철회하실 수 있습니다.\n\n' +
    '이 폼에 남기신 연락처는 앞선 설문 응답과 연결되지 않으며, 면담 일정 조율 목적으로만 사용하고 면담 종료 후 폐기합니다.\n\n' +
    '연구자: ' + CONFIG.researcher + ' / 문의: ' + CONFIG.contact
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('참여 의사를 남겨 주셔서 감사합니다. 연락드리겠습니다.');

  form.addTextItem().setTitle('성함 또는 호칭').setRequired(true);
  form.addTextItem()
    .setTitle('연락처 (이메일 또는 전화번호)')
    .setRequired(true);
  form.addCheckboxItem()
    .setTitle('면담이 가능한 시간대 (선택)')
    .setChoiceValues(['평일 오전', '평일 오후', '평일 저녁', '주말'])
    .setRequired(false);

  return form;
}
