import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Language = 'ja' | 'en'

const STORAGE_KEY = 'grass_puffer_language'

const LOCALE_MAP: Record<string, string> = { ja: 'ja-JP', en: 'en-US' }

type Dictionary = typeof dictionaries.en

const dictionaries = {
  en: {
    appTitle: 'Diary',
    documentTitle: 'Grass Puffer Diary',
    common: {
      cancel: 'Cancel',
      delete: 'Delete',
      discard: 'Discard',
      save: 'Save',
      saved: 'Saved',
      saving: 'Saving',
      savingEllipsis: 'Saving…',
      close: 'Close',
      today: 'Today',
      current: 'Current',
      unsaved: 'Unsaved',
      settings: 'Settings',
      language: 'Language',
      japanese: 'Japanese',
      english: 'English',
    },
    app: {
      closeMenu: 'Close menu',
      signOut: 'Sign out',
      loadingEntries: 'Loading entries…',
      recent: 'Recent',
      noTextYet: 'No text yet',
      restoringSession: 'Restoring your session…',
      signingIn: 'Signing in…',
    },
    calendar: {
      days: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      selectMonth: 'Select month',
      selectYear: 'Select year',
      goToCurrentMonth: 'Go to current month',
      currentMonth: 'Current Month',
    },
    search: {
      placeholder: 'Search entries...',
      searching: 'Searching…',
      loadingEntries: 'Loading entries…',
      indexing: (done: number, total: number) => `Indexing… ${done}/${total}`,
      noResults: 'No results',
      remaining: (count: number) => `Indexing ${count} remaining entries…`,
    },
    login: {
      continueWithGoogle: 'Continue with Google',
      signInWithGoogle: 'Sign in with Google',
      continuePrevious: 'Continue with your previous Google session.',
      privateDiary: 'Your private diary, stored in your Google Drive.',
      sessionExpired: 'Session expired. Please sign in again.',
      sessionExpiredShort: 'Your session has expired.',
      reauthenticate: 'Re-authenticate',
      signInLoadFailed: 'Google Sign-In could not be loaded. Check your network or browser extensions.',
      loadingSignIn: 'Loading Google Sign-In…',
      useAnotherAccount: 'Use another account',
      dataStorageSummary: 'How your data is stored',
      dataStorageItems: [
        'Stored only in your own Google Drive — this app has no backend server',
        "Browser's Content Security Policy only allows connections to Google services (googleapis.com, accounts.google.com, oauth2.googleapis.com) and this website.",
        'Verify: open DevTools → Network tab — every request goes to Google only',
      ],
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
    },
    entry: {
      savedStatus: 'Saved.',
      failedToLoad: 'Failed to load entry.',
      changedElsewhere: 'This entry changed on another device.',
      saveFailed: 'Save failed.',
      loadedLatest: 'Loaded latest version.',
      remoteDeleted: 'Remote entry was deleted.',
      localKept: 'Local edits kept.',
      failedToRefresh: 'Failed to refresh entry.',
      deleteTitle: 'Delete entry?',
      deleteDescription: (date: string) => `The entry for ${date} will be permanently deleted and cannot be undone.`,
      deleteHint: 'Type confirm to proceed',
      confirmKeyword: 'confirm',
      savingOverlay: 'Saving…',
      openMenu: 'Open menu',
      previousDay: 'Previous day',
      nextDay: 'Next day',
      refreshingEntry: 'Refreshing entry',
      refreshEntry: 'Refresh entry',
      saving: 'Saving',
      save: 'Save',
      moreOptions: 'More options',
      history: 'History',
      openInDrive: 'Open in Drive',
      shareEntry: 'Share Entry',
      todaysEntry: "Today's entry",
      yesterdaysEntry: "Yesterday's entry",
      lastModified: 'Last modified:',
      entryLastModified: (label: string) => `${label} - Last modified:`,
      copiedToClipboard: 'Copied to clipboard',
      unsavedLeave: 'Unsaved changes — save before leaving?',
      unsavedRefresh: 'Unsaved changes — save before refreshing?',
      conflictTitle: 'This entry was updated on another device.',
      conflictRemote: 'Load the latest version, keep editing locally, or overwrite the remote entry.',
      conflictDeleted: 'The remote entry was deleted. Keep editing locally or create it again by overwriting.',
      loadLatest: 'Load latest',
      clearLocal: 'Clear local',
      keepLocal: 'Keep local',
      overwrite: 'Overwrite',
      loadingEntry: 'Loading entry',
      placeholder: 'Write your thoughts…',
    },
    settings: {
      title: 'Settings',
      close: 'Close settings',
      darkTheme: 'Dark theme',
      serifFont: 'Serif font',
      autoSave: 'Auto-save',
      exportAllEntries: 'Export all entries',
      shareThisApp: 'Share this app',
      share: 'Share',
      urlCopied: 'URL copied',
      keyboardShortcuts: 'Keyboard shortcuts',
      saveEntry: 'Save entry',
      previousNextDay: 'Previous / Next day',
      goToToday: 'Go to today',
      toggleDarkTheme: 'Toggle dark theme',
      toggleSerifFont: 'Toggle serif font',
      aboutDataStorage: 'About data storage',
      storageIntro: 'Your diary entries are stored in your Google Drive:',
      storageItems: [
        'A folder named GrassPuffer Diary is created automatically',
        'One JSON file per day: diary-YYYY-MM-DD.json',
        'Format: { date, content, updated_at }',
        'This app only accesses files it created (scope: drive.file)',
      ],
    },
    export: {
      title: 'Export all diary entries as ZIP file',
      progress: (done: number, total: number) => `Exporting... (${done}/${total})`,
      exportAll: 'Export all',
      confirmTitle: 'Export all entries?',
      confirmDesc: (count: number) => `${count} entries will be downloaded as a ZIP file. This may take a while.`,
      start: 'Start export',
    },
    history: {
      title: 'Version History',
      current: 'Current',
      unsaved: 'Unsaved',
      restoring: 'Restoring…',
      restoreThisVersion: 'Restore this version',
      failedToLoadHistory: 'Failed to load history.',
      failedToLoadVersion: 'Failed to load this version.',
      restoreConflict: 'Could not restore — entry was changed. Please save first.',
      restoreFailed: 'Restore failed.',
    },
    session: {
      expired: 'Your session has expired. Please log in again.',
      reLoginFailed: 'Re-login failed. Please try again.',
      loggingIn: 'Logging in...',
      logInAgain: 'Log in again',
    },
    dates: {
      today: 'Today',
      yesterday: 'Yesterday',
    },
  },
  ja: {
     appTitle: 'クサフグ日記',
     documentTitle: 'クサフグ日記',
    common: {
      cancel: 'キャンセル',
      delete: '削除',
      discard: '破棄',
      save: '保存',
      saved: '保存済み',
      saving: '保存中...',
      savingEllipsis: '保存中...',
      close: '閉じる',
      today: '今日',
      current: '現在',
      unsaved: '未保存',
      settings: '設定',
      language: '言語',
      japanese: '日本語',
      english: 'English',
    },
    app: {
      closeMenu: 'メニューを閉じる',
      signOut: 'ログアウト',
      loadingEntries: '日記を読み込み中...',
      recent: '最近',
      noTextYet: 'まだ本文がありません',
      restoringSession: 'セッションを復元しています...',
      signingIn: 'ログイン中...',
    },
    calendar: {
      days: ['日', '月', '火', '水', '木', '金', '土'],
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      previousMonth: '前の月',
      nextMonth: '次の月',
      selectMonth: '月を選択',
      selectYear: '年を選択',
      goToCurrentMonth: '今月へ移動',
      currentMonth: '今月',
    },
    search: {
      placeholder: '日記を検索...',
      searching: '検索中...',
      loadingEntries: '日記を読み込み中...',
      indexing: (done: number, total: number) => `インデックス作成中... ${done}/${total}`,
      noResults: '結果がありません',
      remaining: (count: number) => `残り${count}件をインデックス作成中...`,
    },
    login: {
      continueWithGoogle: 'Google で続行',
      signInWithGoogle: 'Google でログイン',
      continuePrevious: '前回の Google セッションで続行します。',
      privateDiary: 'Google Drive に保存する、自分だけの日記です。',
      sessionExpired: 'セッションの有効期限が切れました。もう一度ログインしてください。',
      sessionExpiredShort: 'セッションの有効期限が切れました。',
      reauthenticate: '再認証',
      signInLoadFailed: 'Google ログインを読み込めませんでした。ネットワークやブラウザ拡張機能を確認してください。',
      loadingSignIn: 'Google ログインを読み込み中...',
      useAnotherAccount: '別のアカウントを使う',
      dataStorageSummary: 'データ保存について',
      dataStorageItems: [
        '日記は自分の Google Drive のみに保存されます。このアプリにバックエンドサーバーはありません。',
        'Content Security Policy により、接続先は Google サービス（googleapis.com、accounts.google.com、oauth2.googleapis.com）とこのサイトだけに制限されています。',
        '確認方法: DevTools > Network タブを開くと、すべてのリクエストが Google のみに送られていることを確認できます。',
      ],
      privacyPolicy: 'プライバシーポリシー',
      termsOfService: '利用規約',
    },
    entry: {
      savedStatus: '保存しました。',
      failedToLoad: '日記を読み込めませんでした。',
      changedElsewhere: 'この日記は別の端末で変更されています。',
      saveFailed: '保存に失敗しました。',
      loadedLatest: '最新の内容を読み込みました。',
      remoteDeleted: 'リモートの日記は削除されています。',
      localKept: 'ローカルの編集を保持しました。',
      failedToRefresh: '日記を更新できませんでした。',
      deleteTitle: '日記を削除しますか？',
      deleteDescription: (date: string) => `${date} の日記は完全に削除され、元に戻せません。`,
      deleteHint: '続行するには confirm と入力してください',
      confirmKeyword: 'confirm',
      savingOverlay: '保存中...',
      openMenu: 'メニューを開く',
      previousDay: '前の日',
      nextDay: '次の日',
      refreshingEntry: '日記を更新中',
      refreshEntry: '日記を更新',
      saving: '保存中',
      save: '保存',
      moreOptions: 'その他の操作',
      history: '履歴',
      openInDrive: 'Drive で開く',
      shareEntry: '日記を共有',
      todaysEntry: '今日の日記',
      yesterdaysEntry: '昨日の日記',
      lastModified: '最終更新:',
      entryLastModified: (label: string) => `${label} - 最終更新:`,
      copiedToClipboard: 'クリップボードにコピーしました',
      unsavedLeave: '未保存の変更があります。移動前に保存しますか？',
      unsavedRefresh: '未保存の変更があります。更新前に保存しますか？',
      conflictTitle: 'この日記は別の端末で更新されています。',
      conflictRemote: '最新の内容を読み込むか、ローカルの編集を続けるか、リモートの日記を上書きできます。',
      conflictDeleted: 'リモートの日記は削除されています。ローカルの編集を続けるか、上書きして再作成できます。',
      loadLatest: '最新を読み込む',
      clearLocal: 'ローカルを消去',
      keepLocal: 'ローカルを保持',
      overwrite: '上書き',
      loadingEntry: '日記を読み込み中',
      placeholder: '思ったことを書いてください...',
    },
    settings: {
      title: '設定',
      close: '設定を閉じる',
      darkTheme: 'ダークテーマ',
      serifFont: '明朝体',
      autoSave: '自動保存',
      exportAllEntries: 'すべての日記をエクスポート',
      shareThisApp: 'このアプリを共有',
      share: '共有',
      urlCopied: 'URLをコピーしました',
      keyboardShortcuts: 'キーボードショートカット',
      saveEntry: '日記を保存',
      previousNextDay: '前の日 / 次の日',
      goToToday: '今日へ移動',
      toggleDarkTheme: 'ダークテーマ切替',
      toggleSerifFont: '明朝体切替',
      aboutDataStorage: 'データ保存について',
      storageIntro: '日記は Google Drive に保存されます:',
      storageItems: [
        'GrassPuffer Diary というフォルダが自動作成されます',
        '1日につき1つの JSON ファイル: diary-YYYY-MM-DD.json',
        '形式: { date, content, updated_at }',
        'このアプリは自分で作成したファイルだけにアクセスします（scope: drive.file）',
      ],
    },
    export: {
      title: 'すべての日記を ZIP ファイルとしてエクスポート',
      progress: (done: number, total: number) => `エクスポート中... (${done}/${total})`,
      exportAll: 'すべて出力',
      confirmTitle: 'すべての日記をエクスポートしますか？',
      confirmDesc: (count: number) => `${count}件の日記を ZIP ファイルとしてダウンロードします。時間がかかる場合があります。`,
      start: 'エクスポート開始',
    },
    history: {
      title: '変更履歴',
      current: '現在',
      unsaved: '未保存',
      restoring: '復元中...',
      restoreThisVersion: 'このバージョンを復元',
      failedToLoadHistory: '履歴を読み込めませんでした。',
      failedToLoadVersion: 'このバージョンを読み込めませんでした。',
      restoreConflict: '復元できませんでした。日記が変更されています。先に保存してください。',
      restoreFailed: '復元に失敗しました。',
    },
    session: {
      expired: 'セッションの有効期限が切れました。もう一度ログインしてください。',
      reLoginFailed: '再ログインに失敗しました。もう一度お試しください。',
      loggingIn: 'ログイン中...',
      logInAgain: 'もう一度ログイン',
    },
    dates: {
      today: '今日',
      yesterday: '昨日',
    },
  },
}

interface I18nContextValue {
  language: Language
  locale: string
  t: Dictionary
  setLanguage: (language: Language) => void
}

function readStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ja') {
    return stored
  }
  const browserLang = navigator.language.split('-')[0]
  if (browserLang === 'en') return 'en'
  if (browserLang === 'ja') return 'ja'
  return 'ja'
}

const fallbackContext: I18nContextValue = {
  language: 'ja',
  locale: 'ja-JP',
  t: dictionaries.ja,
  setLanguage: () => {},
}

const I18nContext = createContext<I18nContextValue>(fallbackContext)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((nextLanguage: Language) => {
    localStorage.setItem(STORAGE_KEY, nextLanguage)
    setLanguageState(nextLanguage)
  }, [])

   const value = useMemo<I18nContextValue>(() => ({
     language,
     locale: LOCALE_MAP[language],
     t: dictionaries[language],
     setLanguage,
   }), [language, setLanguage])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = dictionaries[language].documentTitle
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
