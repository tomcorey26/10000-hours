# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]: "WARNING: Secure cookies are OFF — turn back on before real prod use"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: Create an account
      - generic [ref=e7]: Start tracking your 10,000 hours
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Email
          - textbox "Email" [ref=e12]: test-1773935559292@example.com
          - paragraph [ref=e13]: "Invalid input: expected string, received undefined"
        - generic [ref=e14]:
          - generic [ref=e15]: Password
          - textbox "Password" [ref=e16]: testpass123
          - paragraph [ref=e17]: "Invalid input: expected string, received undefined"
        - button "Sign Up" [active] [ref=e18] [cursor=pointer]
      - paragraph [ref=e19]:
        - text: Already have an account?
        - button "Sign in" [ref=e20] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e26] [cursor=pointer]:
    - img [ref=e27]
  - alert [ref=e30]
```