# علت و اقدام بعدی خطای سرویس

پایه401abfc و تغییر محدود httpFailure/failureNextStep:402 با PROVIDER_PAYMENT_REQUIRED،409 با PROVIDER_CONFLICT و413 با PROVIDER_REQUEST_TOO_LARGE از خطای عمومی جدا شدند. 409 به تعارض نام محدود نیست. قرارداد401/403،429،5xx حفظ شد؛ body خام مصرف/نمایش داده نمی‌شود. پیام بعدی، پرداخت و دسترسی و شبکه را از نیاز به اصلاح کد جدا می‌کند.

سه suite هدفمند provider-failures/providers/liara-read،۱۸/۱۸ پاس؛ lint همین سه فایل بدون diagnostic و diff-check پاس. transport مصنوعی در مدل/read/write برای هر status فقط یک بار صدا زده شد، body حذف و retryable به replay تبدیل نشد؛ مدل یا Liara زنده مصرف نشد. این نتیجه full regression candidate نیست. executeApproved خطای پس از claim را همچنان UPSTREAM_UNCERTAIN می‌کند؛ تعیین تکلیف journal/readback پیش از هر write تازه لازم است.
