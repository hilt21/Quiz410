<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw } from 'vue';
import {
  PhArrowRight,
  PhArrowLeft,
  PhBookBookmark,
  PhCheck,
  PhCloudArrowUp,
  PhFlask,
  PhGear,
  PhMoon,
  PhSun,
  PhWarningCircle,
  PhWifiSlash,
} from '@phosphor-icons/vue';
import { loadLibrary } from './engine/library';
import type { Library } from './engine/library';
import { startSession } from './engine/quiz';
import { createProgress, loadProgress, updateStoredProgress, recordAnswer } from './progress/store';
import { syncProgress } from './sync/client';
import { isPracticeCount, loadPracticeCount, savePracticeCount } from './progress/settings';
import type { PracticeQuestion } from './types/quiz';
import TopicIcon from './components/TopicIcon.vue';
import QuizView from './components/QuizView.vue';
const library = shallowRef<Library>(),
  loading = ref(true),
  loadError = ref('');
const page = ref<'home' | 'topic' | 'quiz' | 'result' | 'wrong'>('home'),
  topicId = ref('');
const progress = ref(createProgress()),
  saveError = ref(''),
  corrupt = ref(false);
const saving = ref(false);
const unsaved: { id: string; topic: string; correct: boolean; at: string }[] = [];
const session = shallowRef<PracticeQuestion[]>([]),
  sessionResults = ref<boolean[]>([]);
const practicePool = shallowRef<PracticeQuestion[]>([]),
  explicitLimit = ref<number>();
const exitDialog = ref<HTMLDialogElement>(),
  titleEl = ref<HTMLElement>();
const settingsDialog = ref<HTMLDialogElement>(),
  practiceCount = ref(loadPracticeCount()),
  draftCount = ref<number | string>(practiceCount.value),
  settingsError = ref('');

function openSettings() {
  draftCount.value = practiceCount.value;
  settingsError.value = '';
  settingsDialog.value?.showModal();
}
function saveSettings() {
  const count = Number(draftCount.value);
  if (!isPracticeCount(count)) {
    settingsError.value = '请输入大于零的整数。';
    return;
  }
  try {
    savePracticeCount(count);
    practiceCount.value = count;
    settingsDialog.value?.close();
  } catch {
    settingsError.value = '设置暂时没能保存，请再试一次。';
  }
}
const syncState = ref<'idle' | 'loading' | 'success' | 'error'>('idle'),
  syncError = ref('');
const filter = ref(''),
  showMastered = ref(false),
  online = ref(navigator.onLine);
const media = window.matchMedia('(prefers-color-scheme: dark)'),
  dark = ref(media.matches),
  themeManual = ref(false);
function systemTheme(e: MediaQueryListEvent) {
  if (!themeManual.value) {
    dark.value = e.matches;
    applyTheme();
  }
}
function applyTheme() {
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light';
}
function toggleTheme() {
  themeManual.value = true;
  dark.value = !dark.value;
  applyTheme();
}
function network() {
  online.value = navigator.onLine;
}
const activeTopic = computed(() =>
  library.value?.manifest.topics.find((t) => t.id === topicId.value),
);
const allQuestions = computed(() => library.value?.questions ?? []);
const wrong = computed(() =>
  allQuestions.value.filter((q) => progress.value.records[q.id]?.lastResult === false),
);
const byTopic = computed(() => {
  const groups: Record<string, PracticeQuestion[]> = {};
  for (const q of allQuestions.value) (groups[q.topic] ??= []).push(q);
  return groups;
});
const history = computed(() =>
  allQuestions.value.filter(
    (q) => progress.value.records[q.id]?.wrongCount > 0 && progress.value.records[q.id]?.lastResult,
  ),
);
const filteredWrong = computed(() =>
  (showMastered.value ? history.value : wrong.value).filter(
    (q) => !filter.value || q.topic === filter.value,
  ),
);
const score = computed(() => sessionResults.value.filter(Boolean).length);
const pending = computed(
  () =>
    progress.value.revision > progress.value.syncedRevision &&
    Object.values(progress.value.records).some((r) => r.wrongCount > 0),
);
const baseUrl = import.meta.env.BASE_URL;
const syncEndpoint = import.meta.env.VITE_SYNC_URL ?? '';
function topicQuestions(id: string) {
  return byTopic.value[id] ?? [];
}
function mastered(id: string) {
  return topicQuestions(id).filter((q) => progress.value.records[q.id]?.lastResult).length;
}
function attempts(id: string) {
  return topicQuestions(id).some((q) => progress.value.records[q.id]);
}
async function persist() {
  if (corrupt.value || saving.value) return;
  saving.value = true;
  try {
    do {
      const batch = unsaved.slice();
      const stored = await updateStoredProgress((current) =>
        batch.reduce(
          (state, event) => recordAnswer(state, event.id, event.topic, event.correct, event.at),
          current,
        ),
      );
      unsaved.splice(0, batch.length);
      progress.value = unsaved.reduce(
        (state, event) => recordAnswer(state, event.id, event.topic, event.correct, event.at),
        stored,
      );
    } while (unsaved.length);
    saveError.value = '';
  } catch {
    saveError.value = '这次记录暂时没能保存。请保留此页面，再试一次。';
  } finally {
    saving.value = false;
  }
}
function restore() {
  try {
    const stored = loadProgress();
    progress.value = unsaved.reduce(
      (state, event) => recordAnswer(state, event.id, event.topic, event.correct, event.at),
      stored,
    );
    corrupt.value = false;
    saveError.value = '';
    void persist();
  } catch {
    corrupt.value = true;
    saveError.value = '本机学习记录暂时无法读取，原记录已保留。可以临时练习，但新记录暂不保存。';
  }
}
function storageChanged(event: StorageEvent) {
  if (event.key === 'science-quiz-progress-v1' && !saving.value && !unsaved.length) {
    try {
      progress.value = loadProgress();
    } catch {
      corrupt.value = true;
      saveError.value = '本机学习记录暂时无法读取，原记录已保留。';
    }
  }
}
async function initialize() {
  loading.value = true;
  loadError.value = '';
  try {
    library.value = await loadLibrary();
  } catch {
    loadError.value = '题目暂时没能打开。请检查网络后重试；已有学习记录会保留。';
  } finally {
    loading.value = false;
  }
}
async function go(target: typeof page.value) {
  page.value = target;
  await nextTick();
  titleEl.value?.focus();
  window.scrollTo({ top: 0 });
}
function chooseTopic(id: string) {
  topicId.value = id;
  go('topic');
}
function begin(questions: PracticeQuestion[], limit?: number) {
  practicePool.value = questions;
  explicitLimit.value = limit;
  session.value = startSession(questions, limit ?? practiceCount.value);
  if (session.value.length) go('quiz');
}
function answer(q: PracticeQuestion, correct: boolean) {
  const at = new Date().toISOString();
  unsaved.push({ id: q.id, topic: q.topic, correct, at });
  progress.value = recordAnswer(progress.value, q.id, q.topic, correct, at);
  persist();
  syncState.value = 'idle';
}
function finish(results: boolean[]) {
  sessionResults.value = results;
  go('result');
}
function leaveQuiz() {
  exitDialog.value?.showModal();
}
function confirmExit() {
  exitDialog.value?.close();
  go(activeTopic.value ? 'topic' : 'home');
}
async function sync() {
  if (
    syncState.value === 'loading' ||
    !pending.value ||
    corrupt.value ||
    saveError.value ||
    saving.value
  )
    return;
  syncState.value = 'loading';
  syncError.value = '';
  const snapshot = structuredClone(toRaw(progress.value));
  try {
    const revision = await syncProgress(snapshot, syncEndpoint);
    const stored = await updateStoredProgress((current) => ({
      ...current,
      syncedRevision: Math.max(current.syncedRevision, Math.min(revision, current.revision)),
    }));
    progress.value = unsaved.reduce(
      (state, event) => recordAnswer(state, event.id, event.topic, event.correct, event.at),
      stored,
    );
    syncState.value = 'success';
  } catch (e) {
    syncState.value = 'error';
    syncError.value = e instanceof Error ? e.message : '同步失败，请稍后重试。';
  }
}
onMounted(() => {
  restore();
  initialize();
  applyTheme();
  media.addEventListener('change', systemTheme);
  window.addEventListener('online', network);
  window.addEventListener('offline', network);
  window.addEventListener('storage', storageChanged);
});
onUnmounted(() => {
  media.removeEventListener('change', systemTheme);
  window.removeEventListener('online', network);
  window.removeEventListener('offline', network);
  window.removeEventListener('storage', storageChanged);
});
</script>
<template>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header">
    <div class="header-inner">
      <button
        class="brand"
        aria-label="Science Quiz 首页"
        @click="page === 'quiz' ? leaveQuiz() : go('home')"
      >
        <PhFlask :size="30" weight="duotone" /><span>Science Quiz</span>
      </button>
      <nav v-if="page !== 'quiz'" aria-label="主要导航">
        <button :class="{ active: page === 'home' || page === 'topic' }" @click="go('home')">
          主题练习</button
        ><button :class="{ active: page === 'wrong' }" @click="go('wrong')">
          我的错题<span v-if="wrong.length" class="nav-count">{{ wrong.length }}</span>
        </button>
      </nav>
      <div class="header-actions">
        <button
          class="theme-button"
          :aria-label="dark ? '切换浅色模式' : '切换深色模式'"
          @click="toggleTheme"
        >
          <component :is="dark ? PhSun : PhMoon" :size="21" />
        </button>
        <button class="theme-button" aria-label="练习设置" @click="openSettings">
          <PhGear :size="21" />
        </button>
      </div>
    </div>
  </header>
  <main id="main" class="main-container">
    <div v-if="!online" class="notice">
      <PhWifiSlash :size="20" />当前离线，已加载的题目可以继续练习。
    </div>
    <div v-if="saveError" class="notice warning" role="alert">
      <PhWarningCircle :size="24" /><span>{{ saveError }}</span
      ><button class="text-button" @click="corrupt ? restore() : persist()">重试保存</button>
    </div>
    <div v-if="loading" class="loading-state" aria-live="polite">
      <h1>正在准备题目</h1>
      <div class="skeleton-grid"><div v-for="n in 4" :key="n" class="skeleton" /></div>
    </div>
    <section v-else-if="loadError" class="empty-state">
      <PhBookBookmark :size="60" weight="duotone" />
      <h1>稍等一下，题目还没准备好</h1>
      <p role="alert">{{ loadError }}</p>
      <button class="button primary" @click="initialize">重新加载</button>
    </section>
    <template v-else-if="library">
      <template v-if="page === 'home'">
        <section class="home-intro">
          <div>
            <p class="eyebrow">从一个小问题开始</p>
            <h1 ref="titleEl" tabindex="-1">今天想挑战什么？</h1>
            <p>选一个主题，发现身边的科学。</p>
            <div class="intro-meta">
              {{ library.manifest.topics.length }} 个主题 <span>/</span>
              {{ allQuestions.length }} 道探索题
            </div>
          </div>
          <img
            class="science-art"
            :src="`${baseUrl}assets/science-objects.png`"
            alt=""
            width="420"
            height="280"
            fetchpriority="high"
          />
        </section>
        <section class="topic-grid" aria-label="科学主题">
          <article v-for="topic in library.manifest.topics" :key="topic.id" class="topic-card">
            <div class="topic-copy">
              <h2>{{ topic.title }}</h2>
              <p>{{ topic.description }}</p>
              <div class="topic-meta">
                <span>{{
                  attempts(topic.id)
                    ? `已掌握 ${mastered(topic.id)} / ${topicQuestions(topic.id).length}`
                    : `${topicQuestions(topic.id).length} 道题，尚未开始`
                }}</span>
              </div>
              <button
                class="button compact"
                :aria-label="`开始挑战：${topic.title}`"
                @click="chooseTopic(topic.id)"
              >
                开始挑战<PhArrowRight :size="17" />
              </button>
            </div>
            <div class="topic-art"><TopicIcon :name="topic.icon" /></div>
          </article>
        </section>
        <button class="wrong-entry" @click="go('wrong')">
          <span class="entry-icon"><PhBookBookmark :size="30" weight="duotone" /></span
          ><span
            ><strong>我的错题</strong
            ><small>{{
              wrong.length ? '把还不熟悉的知识，再想一遍。' : '每一次思考，都让你更进一步。'
            }}</small></span
          ><span class="entry-count">{{ wrong.length }} 题<PhArrowRight :size="20" /></span>
        </button>
        <p class="local-note"><PhCheck :size="17" />学习记录保存在这台设备，无需注册。</p>
      </template>
      <section v-else-if="page === 'topic' && activeTopic" class="topic-detail">
        <button class="text-button" @click="go('home')"><PhArrowLeft :size="20" />全部主题</button>
        <div class="detail-heading">
          <TopicIcon :name="activeTopic.icon" />
          <h1 ref="titleEl" tabindex="-1">{{ activeTopic.title }}</h1>
          <p>{{ activeTopic.description }}</p>
        </div>
        <div class="practice-card">
          <h2>准备好，来探索一下</h2>
          <p>每次练习 {{ practiceCount }} 题，选好答案后提交，马上查看反馈与解析。</p>
          <div class="detail-stats">
            <span
              ><strong>{{ topicQuestions(activeTopic.id).length }}</strong
              >道题可以探索</span
            ><span
              ><strong>{{ mastered(activeTopic.id) }}</strong
              >道题已掌握</span
            >
          </div>
          <p class="muted">
            包含判断、单选或多选题。题目不足时按实际数量练习；材料题整组出现，题数可能超过设置数量，并保持组内顺序。
          </p>
          <button class="button primary wide" @click="begin(topicQuestions(activeTopic.id))">
            开始练习<PhArrowRight :size="21" />
          </button>
        </div>
        <section v-if="library.banks[activeTopic.id].groups.length" class="scenario-list">
          <h2>也可以从一个实验开始</h2>
          <button
            v-for="group in library.banks[activeTopic.id].groups"
            :key="group.id"
            class="scenario-entry"
            @click="
              begin(
                topicQuestions(activeTopic.id).filter((q) => group.questionIds.includes(q.id)),
                group.questionIds.length,
              )
            "
          >
            <span
              ><strong>{{ group.title.replace(/^情境[^：]+：/, '') }}</strong
              ><small>{{ group.questionIds.length }} 题，共用一份实验材料</small></span
            ><PhArrowRight :size="22" />
          </button>
        </section>
      </section>
      <QuizView
        v-else-if="page === 'quiz'"
        :questions="session"
        @answer="answer"
        @finish="finish"
        @exit="leaveQuiz"
      />
      <section v-else-if="page === 'result'" class="result-page">
        <PhFlask class="result-icon" :size="64" weight="duotone" />
        <h1 ref="titleEl" tabindex="-1">完成！</h1>
        <p>又完成了一次科学探索。</p>
        <div class="score">
          {{ score }}<span>/ {{ session.length }}</span>
        </div>
        <p>首次作答：答对 {{ score }} 题，答错 {{ session.length - score }} 题</p>
        <p class="muted">
          {{
            score === session.length
              ? '这次全部答对了，继续保持好奇心！'
              : '重试后的掌握情况，已经更新到我的错题。'
          }}
        </p>
        <div class="result-actions">
          <button
            v-if="score < session.length"
            class="button primary wide"
            @click="
              showMastered = false;
              filter = '';
              go('wrong');
            "
          >
            查看错题<PhArrowRight :size="20" /></button
          ><button
            class="button wide"
            :class="score === session.length ? 'primary' : 'secondary'"
            @click="begin(practicePool, explicitLimit)"
          >
            再练一次</button
          ><button class="text-button" @click="go(activeTopic ? 'topic' : 'home')">返回主题</button>
        </div>
        <p v-if="!saveError && !saving" class="local-note">
          <PhCheck :size="17" />{{ corrupt ? '临时练习，未保存' : '本次学习记录已保存在本机' }}
        </p>
      </section>
      <section v-else-if="page === 'wrong'" class="wrong-page">
        <div class="page-title">
          <p class="eyebrow">把不熟悉，变成熟悉</p>
          <h1 ref="titleEl" tabindex="-1">我的错题</h1>
          <p>再想一想，你会发现新的线索。</p>
        </div>
        <div class="wrong-toolbar">
          <div class="segmented" aria-label="复习状态">
            <button :aria-pressed="!showMastered" @click="showMastered = false">
              待复习 {{ wrong.length }}</button
            ><button :aria-pressed="showMastered" @click="showMastered = true">
              已掌握 {{ history.length }}
            </button>
          </div>
          <label class="topic-filter"
            ><span class="sr-only">按主题筛选</span
            ><select v-model="filter">
              <option value="">全部主题</option>
              <option v-for="t in library.manifest.topics" :key="t.id" :value="t.id">
                {{ t.title }}
              </option>
            </select></label
          >
        </div>
        <div v-if="!filteredWrong.length" class="empty-state">
          <PhBookBookmark :size="64" weight="duotone" />
          <h2>{{ showMastered ? '这里会留下你的进步' : '这里还没有待复习的错题' }}</h2>
          <p>
            {{
              filter
                ? '试试其他主题，或继续探索新的题目。'
                : '每答对一道曾经的错题，它就会移到已掌握。'
            }}
          </p>
          <button class="button primary" @click="go('home')">
            去练习<PhArrowRight :size="20" />
          </button>
        </div>
        <template v-else
          ><div class="review-start">
            <span
              >共 {{ filteredWrong.length }} 题{{
                filteredWrong.length > practiceCount
                  ? `，先练 ${practiceCount} 题（材料题整组出现）`
                  : ''
              }}</span
            ><button
              class="button primary"
              @click="
                topicId = '';
                begin(filteredWrong);
              "
            >
              {{ showMastered ? '再巩固一次' : '再练错题' }}<PhArrowRight :size="20" />
            </button>
          </div>
          <div class="wrong-list">
            <button
              v-for="q in filteredWrong"
              :key="q.id"
              class="wrong-row"
              @click="
                topicId = q.topic;
                begin([q], 1);
              "
            >
              <span
                ><small
                  >{{ library.manifest.topics.find((t) => t.id === q.topic)?.title
                  }}<template v-if="q.group">
                    / {{ q.group.title.replace(/^情境[^：]+：/, '') }}</template
                  ></small
                ><strong>{{ q.question }}</strong
                ><small
                  >练习 {{ progress.records[q.id].attempts }} 次，{{
                    showMastered ? '最近已答对' : '还可以再想一想'
                  }}</small
                ></span
              ><PhArrowRight :size="22" />
            </button></div
        ></template>
        <section class="sync-panel" aria-labelledby="sync-title">
          <div>
            <h2 id="sync-title"><PhCloudArrowUp :size="25" />错题备份</h2>
            <p>可选：将学习记录备份到 GitHub。</p>
            <p class="muted">
              {{
                !syncEndpoint
                  ? '云端备份暂不可用，本机练习照常使用。'
                  : pending
                    ? `${wrong.length} 个待复习错题，学习记录有更新`
                    : '已同步或暂无需要同步的错题'
              }}
            </p>
          </div>
          <button
            class="button secondary"
            :disabled="
              !syncEndpoint ||
              !pending ||
              syncState === 'loading' ||
              !!saveError ||
              corrupt ||
              saving
            "
            @click="sync"
          >
            {{
              syncState === 'loading'
                ? '正在同步'
                : syncState === 'error'
                  ? '重新同步'
                  : '同步错题到 GitHub'
            }}
          </button>
          <p v-if="syncState === 'success'" class="sync-status" role="status">同步成功。</p>
          <p v-if="syncState === 'error'" class="sync-status" role="alert">
            {{ syncError }} {{ !saveError && !corrupt && !saving ? '本地数据已保存。' : '' }}
          </p>
        </section>
      </section>
    </template>
  </main>
  <footer v-if="page !== 'quiz'" class="site-footer">
    <span>Science Quiz</span><span>保持好奇，慢慢探索。</span>
  </footer>
  <dialog ref="exitDialog" class="exit-dialog" aria-labelledby="exit-title">
    <h2 id="exit-title">先休息一下？</h2>
    <p>
      {{
        saveError || saving
          ? '部分记录尚未保存，离开页面可能丢失。'
          : '已提交的答案已记录，本次未完成的题目不会计分。'
      }}
    </p>
    <div class="dialog-actions">
      <button class="button primary" autofocus @click="exitDialog?.close()">继续练习</button
      ><button class="button secondary" @click="confirmExit">返回主题</button>
    </div>
  </dialog>
  <dialog ref="settingsDialog" class="exit-dialog settings-dialog" aria-labelledby="settings-title">
    <form @submit.prevent="saveSettings">
      <h2 id="settings-title">练习设置</h2>
      <label for="practice-count">每次练习题数</label>
      <input
        id="practice-count"
        v-model="draftCount"
        name="practice-count"
        type="number"
        min="1"
        :max="Number.MAX_SAFE_INTEGER"
        step="1"
        inputmode="numeric"
        required
        autofocus
        aria-describedby="settings-help"
      />
      <p id="settings-help" class="muted">
        适用于所有主题、错题和再次练习，从下一次练习生效。题目不足时按实际数量练习。材料题整组保留，题数可能超过设置数量；单题复习和指定材料练习按所选题目进行。
      </p>
      <p v-if="settingsError" role="alert">{{ settingsError }}</p>
      <div class="dialog-actions">
        <button type="submit" class="button primary">保存设置</button>
        <button type="button" class="button secondary" @click="settingsDialog?.close()">
          取消
        </button>
      </div>
    </form>
  </dialog>
</template>
