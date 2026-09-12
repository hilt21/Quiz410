<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  PhArrowLeft,
  PhCheckCircle,
  PhArrowRight,
  PhBookOpen,
  PhCaretDown,
  PhCaretUp,
} from '@phosphor-icons/vue';
import { checkAnswer } from '../engine/quiz';
import type { PracticeQuestion } from '../types/quiz';
import MaterialContent from './MaterialContent.vue';
const props = defineProps<{ questions: PracticeQuestion[] }>();
const emit = defineEmits<{
  answer: [question: PracticeQuestion, correct: boolean];
  finish: [results: boolean[]];
  exit: [];
}>();
const index = ref(0),
  selected = ref<string[]>([]),
  submitted = ref(false),
  revealed = ref(false),
  collapsed = ref(false);
const results = ref<boolean[]>([]),
  heading = ref<HTMLElement>();
const current = computed(() => props.questions[index.value]);
const correct = computed(() => checkAnswer(current.value, selected.value));
const label = computed(
  () =>
    ({ 'single-choice': '单选题', 'multiple-choice': '多选题', 'true-false': '判断题' })[
      current.value.type
    ],
);
const groupLabel = computed(() =>
  current.value.group
    ? `材料题 · 第 ${current.value.group.questionIds.indexOf(current.value.id) + 1} / ${current.value.group.questionIds.length} 题`
    : label.value,
);
watch(index, async (_, old) => {
  selected.value = [];
  submitted.value = false;
  revealed.value = false;
  if (props.questions[old].group?.id !== current.value.group?.id) collapsed.value = false;
  await nextTick();
  heading.value?.focus();
  window.scrollTo({ top: 0 });
});
function submit() {
  if (submitted.value || !selected.value.length) return;
  submitted.value = true;
  if (results.value[index.value] === undefined) results.value[index.value] = correct.value;
  emit('answer', current.value, correct.value);
}
function retry() {
  submitted.value = false;
  revealed.value = false;
  selected.value = [];
}
function next() {
  if (index.value + 1 === props.questions.length) emit('finish', results.value);
  else index.value++;
}
const choiceText = computed(() =>
  current.value.options
    .filter((o) => selected.value.includes(o.id))
    .map((o) => o.text)
    .join('、'),
);
</script>
<template>
  <div class="quiz-top">
    <button class="text-button" @click="emit('exit')"><PhArrowLeft :size="20" />返回主题</button
    ><span
      >本次练习 <strong>{{ index + 1 }} / {{ questions.length }}</strong></span
    >
  </div>
  <progress
    class="quiz-progress"
    :value="index"
    :max="questions.length"
    aria-label="本次练习已完成题数"
  />
  <div class="quiz-heading">
    <p class="eyebrow">{{ groupLabel }}</p>
    <h1 ref="heading" tabindex="-1">
      {{ current.group?.title.replace(/^情境[^：]+：/, '') || '观察一下，再选出答案' }}
    </h1>
  </div>
  <div class="quiz-layout" :class="{ 'has-material': current.group }">
    <aside v-if="current.group" class="material-panel">
      <div class="material-title">
        <h2><PhBookOpen :size="23" />实验材料</h2>
        <button
          class="text-button collapse-button"
          :aria-expanded="!collapsed"
          aria-controls="shared-material"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? '展开材料' : '收起材料'
          }}<component :is="collapsed ? PhCaretDown : PhCaretUp" :size="16" />
        </button>
      </div>
      <MaterialContent v-show="!collapsed" id="shared-material" :blocks="current.group.material" />
    </aside>
    <section class="question-panel" aria-label="答题区">
      <div class="question-type">
        {{ label }}<span v-if="current.type === 'multiple-choice'">可选择多个答案</span
        ><span v-else>选择一个答案</span>
      </div>
      <MaterialContent v-if="current.material" :blocks="current.material" />
      <form @submit.prevent="submit">
        <fieldset :disabled="submitted">
          <legend>{{ current.question.replace(/（\s*）$/, '') }}</legend>
          <label
            v-for="(option, i) in current.options"
            :key="current.id + option.id"
            class="answer-option"
            :class="{
              selected: selected.includes(option.id),
              'is-correct':
                submitted && (correct || revealed) && current.answer.includes(option.id),
            }"
          >
            <input
              v-if="current.type === 'multiple-choice'"
              v-model="selected"
              type="checkbox"
              :value="option.id"
              :name="current.id"
            />
            <input
              v-else
              :checked="selected.includes(option.id)"
              type="radio"
              :value="option.id"
              :name="current.id"
              @change="selected = [option.id]"
            />
            <span
              class="option-letter"
              :class="{ square: current.type === 'multiple-choice' }"
              aria-hidden="true"
              >{{
                current.type === 'true-false' ? (i === 0 ? '✓' : '×') : String.fromCharCode(65 + i)
              }}</span
            >
            <span>{{ option.text }}</span
            ><PhCheckCircle
              v-if="submitted && (correct || revealed) && current.answer.includes(option.id)"
              class="option-check"
              :size="23"
              aria-label="正确选项"
            />
          </label>
        </fieldset>
        <div v-if="!submitted" class="submit-area">
          <p class="selection-help">
            {{
              selected.length
                ? current.type === 'multiple-choice'
                  ? `已选择 ${selected.length} 项，选好后提交`
                  : '选好后，点击提交答案'
                : '先选择一个答案'
            }}
          </p>
          <button class="button primary wide" type="submit" :disabled="!selected.length">
            提交答案<PhArrowRight :size="20" />
          </button>
        </div>
      </form>
      <section v-if="submitted" class="feedback" aria-live="polite" aria-atomic="true">
        <h2><PhCheckCircle v-if="correct" :size="26" />{{ correct ? '答对了！' : '再想一想' }}</h2>
        <p v-if="!correct">这次还不对。你选择了：{{ choiceText }}。</p>
        <template v-if="correct || revealed"
          ><p v-if="!correct">
            <strong>正确答案：</strong
            >{{
              current.options
                .filter((o) => current.answer.includes(o.id))
                .map((o) => o.text)
                .join('、')
            }}
          </p>
          <p>{{ current.explanation }}</p>
          <button class="button primary wide" @click="next">
            {{ index + 1 === questions.length ? '查看结果' : '下一题'
            }}<PhArrowRight :size="20" /></button
        ></template>
        <div v-else class="feedback-actions">
          <button class="button primary" @click="retry">重新选择</button
          ><button class="button secondary" @click="revealed = true">查看解析</button>
        </div>
      </section>
    </section>
  </div>
</template>
