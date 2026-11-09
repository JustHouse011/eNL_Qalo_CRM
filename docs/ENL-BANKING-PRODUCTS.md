# eNL Banking Products Hub

The [eNL product catalogue](https://enlbank.co.za/products) provides the product names and positioning. Its four listed Pusha and Owner variants point to the bank’s coming-soon page. Existing CRM case product keys are retained for every entry, including shared Pusha Account and Owner Account parent keys. The supplied text defines the interface and catalogue order.

| Display name | Local image | Case product key |
| --- | --- | --- |
| Becha Account | `Becha.png` | Becha Account |
| Nala Account | `Nala.png` | Nala Account |
| Temo Account | `Temo Account.png` | Temo Account |
| Temo Savings Account | `Temo Savings.jpeg` | Temo Savings |
| iMbewu Savings Account | `Imbewu savings.jpg` | iMbewu Savings |
| Pusha — Sole Proprietor | `Sole Proprietor.jpg` | Pusha Account |
| Pusha — Informal Trader | `informal trader.jpeg` | Pusha Account |
| Owner — Private Company | `private company.png` | Owner Account |
| Owner — Co-operative | `Co-operative.jpeg` | Owner Account |
| Stokvel Account | `Stokvel.jpg` | Stokvel Account |

Images are served from `public/enl products` at `/enl%20products/` with encoded filenames. The grid searches the catalogue reference content, including FAQ titles. Product details link to existing workspace records, using the original case product key, ticket references or recorded product enquiry categories, and relevant knowledge articles.

The product editor uses `manage-workspace` for both UI access and the save command. Edits use the existing workspace browser store. A revision check guards against overwriting a newer edit. Availability changes update the workspace catalogue display. Names, descriptions, images, FAQs and other content edits stay in the internal draft, where authorised staff can preview them. Save for review marks the draft as requiring review. The current app has no production approval service. The catalogue reference leaves unverified eligibility, fees, limits and terms unpopulated.
