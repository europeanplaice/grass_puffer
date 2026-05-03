# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authRestore.test.ts >> expired save reauth retries with the refreshed token without showing re-login failed
- Location: tests/authRestore.test.ts:116:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.uncheck: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('checkbox', { name: 'Auto-save' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - heading "Diary" [level=1] [ref=e6]:
        - img [ref=e7]
        - text: Diary
      - generic [ref=e8]:
        - button "Toggle theme" [ref=e9] [cursor=pointer]:
          - img [ref=e10]
        - button "Toggle font" [ref=e12] [cursor=pointer]:
          - img [ref=e13]:
            - generic [ref=e14]: S
        - button "↩" [ref=e15] [cursor=pointer]
    - searchbox "Search entries..." [ref=e17]
    - generic [ref=e18]:
      - generic [ref=e19]:
        - button "Previous month" [ref=e20] [cursor=pointer]: ‹
        - generic [ref=e21]:
          - combobox "Select month" [ref=e22] [cursor=pointer]:
            - option "January"
            - option "February"
            - option "March"
            - option "April"
            - option "May" [selected]
            - option "June"
            - option "July"
            - option "August"
            - option "September"
            - option "October"
            - option "November"
            - option "December"
          - combobox "Select year" [ref=e23] [cursor=pointer]:
            - option "1926"
            - option "1927"
            - option "1928"
            - option "1929"
            - option "1930"
            - option "1931"
            - option "1932"
            - option "1933"
            - option "1934"
            - option "1935"
            - option "1936"
            - option "1937"
            - option "1938"
            - option "1939"
            - option "1940"
            - option "1941"
            - option "1942"
            - option "1943"
            - option "1944"
            - option "1945"
            - option "1946"
            - option "1947"
            - option "1948"
            - option "1949"
            - option "1950"
            - option "1951"
            - option "1952"
            - option "1953"
            - option "1954"
            - option "1955"
            - option "1956"
            - option "1957"
            - option "1958"
            - option "1959"
            - option "1960"
            - option "1961"
            - option "1962"
            - option "1963"
            - option "1964"
            - option "1965"
            - option "1966"
            - option "1967"
            - option "1968"
            - option "1969"
            - option "1970"
            - option "1971"
            - option "1972"
            - option "1973"
            - option "1974"
            - option "1975"
            - option "1976"
            - option "1977"
            - option "1978"
            - option "1979"
            - option "1980"
            - option "1981"
            - option "1982"
            - option "1983"
            - option "1984"
            - option "1985"
            - option "1986"
            - option "1987"
            - option "1988"
            - option "1989"
            - option "1990"
            - option "1991"
            - option "1992"
            - option "1993"
            - option "1994"
            - option "1995"
            - option "1996"
            - option "1997"
            - option "1998"
            - option "1999"
            - option "2000"
            - option "2001"
            - option "2002"
            - option "2003"
            - option "2004"
            - option "2005"
            - option "2006"
            - option "2007"
            - option "2008"
            - option "2009"
            - option "2010"
            - option "2011"
            - option "2012"
            - option "2013"
            - option "2014"
            - option "2015"
            - option "2016"
            - option "2017"
            - option "2018"
            - option "2019"
            - option "2020"
            - option "2021"
            - option "2022"
            - option "2023"
            - option "2024"
            - option "2025"
            - option "2026" [selected]
            - option "2027"
            - option "2028"
            - option "2029"
            - option "2030"
            - option "2031"
            - option "2032"
            - option "2033"
            - option "2034"
            - option "2035"
            - option "2036"
        - button "Next month" [ref=e24] [cursor=pointer]: ›
      - button "Today" [ref=e26] [cursor=pointer]
      - generic [ref=e27]:
        - generic [ref=e28]: Su
        - generic [ref=e29]: Mo
        - generic [ref=e30]: Tu
        - generic [ref=e31]: We
        - generic [ref=e32]: Th
        - generic [ref=e33]: Fr
        - generic [ref=e34]: Sa
        - button "2026-05-01" [ref=e40] [cursor=pointer]: "1"
        - button "2026-05-02" [ref=e41] [cursor=pointer]: "2"
        - button "2026-05-03" [ref=e42] [cursor=pointer]: "3"
        - button "2026-05-04" [ref=e43] [cursor=pointer]: "4"
        - button "2026-05-05" [ref=e44] [cursor=pointer]: "5"
        - button "2026-05-06" [ref=e45] [cursor=pointer]: "6"
        - button "2026-05-07" [ref=e46] [cursor=pointer]: "7"
        - button "2026-05-08" [ref=e47] [cursor=pointer]: "8"
        - button "2026-05-09" [ref=e48] [cursor=pointer]: "9"
        - button "2026-05-10" [ref=e49] [cursor=pointer]: "10"
        - button "2026-05-11" [ref=e50] [cursor=pointer]: "11"
        - button "2026-05-12" [ref=e51] [cursor=pointer]: "12"
        - button "2026-05-13" [ref=e52] [cursor=pointer]: "13"
        - button "2026-05-14" [ref=e53] [cursor=pointer]: "14"
        - button "2026-05-15" [ref=e54] [cursor=pointer]: "15"
        - button "2026-05-16" [ref=e55] [cursor=pointer]: "16"
        - button "2026-05-17" [ref=e56] [cursor=pointer]: "17"
        - button "2026-05-18" [ref=e57] [cursor=pointer]: "18"
        - button "2026-05-19" [ref=e58] [cursor=pointer]: "19"
        - button "2026-05-20" [ref=e59] [cursor=pointer]: "20"
        - button "2026-05-21" [ref=e60] [cursor=pointer]: "21"
        - button "2026-05-22" [ref=e61] [cursor=pointer]: "22"
        - button "2026-05-23" [ref=e62] [cursor=pointer]: "23"
        - button "2026-05-24" [ref=e63] [cursor=pointer]: "24"
        - button "2026-05-25" [ref=e64] [cursor=pointer]: "25"
        - button "2026-05-26" [ref=e65] [cursor=pointer]: "26"
        - button "2026-05-27" [ref=e66] [cursor=pointer]: "27"
        - button "2026-05-28" [ref=e67] [cursor=pointer]: "28"
        - button "2026-05-29" [ref=e68] [cursor=pointer]: "29"
        - button "2026-05-30" [ref=e69] [cursor=pointer]: "30"
        - button "2026-05-31" [ref=e70] [cursor=pointer]: "31"
    - list [ref=e71]
    - button "Settings" [ref=e72] [cursor=pointer]:
      - img [ref=e73]
      - generic [ref=e76]: Settings
  - main [ref=e77]:
    - generic [ref=e78]:
      - generic [ref=e79]:
        - generic [ref=e80]:
          - button "Previous day" [ref=e81] [cursor=pointer]: ‹
          - heading "May 3, 2026 Sun, Today" [level=2] [ref=e82]:
            - generic "May 3, 2026 Sun, Today" [ref=e83]:
              - generic [ref=e84]: May 3, 2026
              - generic [ref=e85]: Sun
          - button "Next day" [ref=e86] [cursor=pointer]: ›
        - button "Save" [disabled] [ref=e88]:
          - img [ref=e89]
          - generic [ref=e91]: Save
      - textbox "Write your thoughts…" [active] [ref=e92]
```

# Test source

```ts
  65  |     if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
  66  |       await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
  67  |       return
  68  |     }
  69  |     await route.fulfill({ json: { files: [] } })
  70  |   })
  71  | })
  72  | 
  73  | test('previous session shows one-click restore without requesting a token on page load', async ({ page }) => {
  74  |   await page.addInitScript(installGoogleMock, true)
  75  | 
  76  |   await page.goto(baseUrl)
  77  |   await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  78  | 
  79  |   await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  80  |   await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(0)
  81  | 
  82  |   await page.getByRole('button', { name: 'Continue with Google' }).click()
  83  | 
  84  |   await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(1)
  85  |   await expect.poll(() => page.evaluate(() => (
  86  |     window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }
  87  |   ).__lastTokenRequestConfig)).toEqual({ prompt: '' })
  88  |   await expect(page.locator('.editor-textarea')).toBeVisible()
  89  | })
  90  | 
  91  | test('first-time visitors still see the normal Google sign-in action', async ({ page }) => {
  92  |   await page.addInitScript(installGoogleMock, false)
  93  | 
  94  |   await page.goto(baseUrl)
  95  |   await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  96  | 
  97  |   await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  98  |   await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  99  | })
  100 | 
  101 | test('previous session can be forgotten before requesting a token', async ({ page }) => {
  102 |   await page.addInitScript(installGoogleMock, true)
  103 | 
  104 |   await page.goto(baseUrl)
  105 |   await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  106 | 
  107 |   await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  108 |   await page.getByRole('button', { name: 'Use another account' }).click()
  109 | 
  110 |   await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  111 |   await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  112 |   await expect.poll(() => page.evaluate(() => localStorage.getItem('grass-puffer-auth-restorable'))).toBeNull()
  113 |   await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(0)
  114 | })
  115 | 
  116 | test('expired save reauth retries with the refreshed token without showing re-login failed', async ({ page }) => {
  117 |   await page.addInitScript(installExpiringGoogleMock)
  118 | 
  119 |   const uploadTokens: string[] = []
  120 | 
  121 |   await page.route('https://www.googleapis.com/upload/drive/v3/files**', async route => {
  122 |     const token = route.request().headers().authorization ?? ''
  123 |     if (token === 'Bearer test-token-1') {
  124 |       await route.fulfill({ status: 401, body: 'expired' })
  125 |       return
  126 |     }
  127 |     uploadTokens.push(token)
  128 |     await route.fulfill({
  129 |       json: {
  130 |         id: 'file-1',
  131 |         name: 'diary-2026-05-02.json',
  132 |         version: '1',
  133 |         modifiedTime: '2026-05-02T00:00:00.000Z',
  134 |       },
  135 |     })
  136 |   })
  137 | 
  138 |   await page.route('https://www.googleapis.com/drive/v3/files**', async route => {
  139 |     const request = route.request()
  140 |     const url = decodeURIComponent(request.url())
  141 | 
  142 |     if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
  143 |       await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
  144 |       return
  145 |     }
  146 | 
  147 |     if (url.includes("'folder-1' in parents") && url.includes("name='diary-")) {
  148 |       await route.fulfill({ json: { files: [] } })
  149 |       return
  150 |     }
  151 | 
  152 |     if (url.includes("'folder-1' in parents")) {
  153 |       await route.fulfill({ json: { files: [] } })
  154 |       return
  155 |     }
  156 | 
  157 |     await route.fulfill({ json: {} })
  158 |   })
  159 | 
  160 |   await page.goto(baseUrl)
  161 |   await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  162 |   await page.getByRole('button', { name: 'Sign in with Google' }).click()
  163 |   await expect(page.locator('.editor-textarea')).toBeVisible()
  164 | 
> 165 |   await page.getByRole('checkbox', { name: 'Auto-save' }).uncheck()
      |                                                           ^ Error: locator.uncheck: Test timeout of 30000ms exceeded.
  166 |   await page.locator('.editor-textarea').fill('saved after refreshed token')
  167 |   await page.getByRole('button', { name: 'Save' }).click()
  168 | 
  169 |   await expect(page.getByText('Your session has expired. Please log in again.')).toBeVisible()
  170 |   await page.getByRole('button', { name: 'Log in again' }).click()
  171 | 
  172 |   await expect(page.getByText('Re-login failed. Please try again.')).toHaveCount(0)
  173 |   await expect(page.getByText('Your session has expired. Please log in again.')).toHaveCount(0)
  174 |   await expect.poll(() => page.evaluate(() => (
  175 |     window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }
  176 |   ).__lastTokenRequestConfig)).toEqual({ prompt: '' })
  177 |   await expect.poll(() => uploadTokens).toEqual(['Bearer test-token-2'])
  178 | })
  179 | 
```