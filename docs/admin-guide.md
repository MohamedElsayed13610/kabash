# Admin dashboard guide

Open `/admin` on your phone (sign in at `/staff/login` first). The board for orders stays at `/staff`.

| Section | Who | What you do there |
|---|---|---|
| نظرة عامة | owner, manager | Today's numbers and a to-do list: sample items still to review, missing photos, sample zones/offers, placeholder phone numbers. |
| المنيو | owner, manager | Categories (restaurant / butcher) and items. Drag ⠿ to reorder. Flip **متاح / خلصت** when something runs out. Tap an item to edit price, sizes, extras, photo. |
| العروض | owner, manager | Percent or fixed discounts on one item, one category, or the whole order, with optional start and end (Cairo time). |
| التوصيل | owner, manager | Add, edit, reorder, disable or delete delivery zones, fees, minimums and ETAs. Free delivery above a total. |
| التقارير | owner, manager | Orders and revenue by day or week (7 / 30 / 90 days), top items, restaurant vs butcher. Table view for accessibility. |
| الإعدادات | owner | Opening hours, manual open/closed override, accept orders when closed, WhatsApp and phone, address, social links, announcement banner. |
| الموظفين | owner | Create staff, change role, reset password, stop or delete an account. |

## Photos
Tap **اختار صورة**, drag to position, zoom with the slider, then **تمام، ارفع الصورة**. The photo is cropped (items: square, offers: 16:9), compressed to WebP in your browser, and stored in Supabase Storage. Replacing or removing a photo deletes the old file. If you cancel the editor, a photo you uploaded but didn't save is deleted too.

## Rules worth knowing
- **Prices and zones are never hard-coded.** A fee change applies to new orders at once; orders already placed keep the fee and prices they were placed with.
- **Offers:** each cart line gets at most one item/category offer (the best); one cart-wide offer (the best) applies after that. A fixed amount on an item/category applies once per line.
- **Sample data** is marked **عينة**. Editing an item and switching off "صنف تجريبي" marks it as real.
- **Roles:** managers cannot open Settings or Staff (pages and API both refuse). You cannot demote, stop or delete your own account, and the last active owner cannot be removed.
- **Closed restaurant:** by default customers can browse but not order. Switch on "استقبال طلبات وأنت مقفول" to accept orders anyway.
- Changes to the menu, offers, zones and settings show on the public site immediately.
