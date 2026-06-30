select customers.id as customer_id, country_codes.country_code, 'vip' as segment
from {{ ref('customers') }} as customers
left join {{ ref('country_codes') }} as country_codes on country_codes.customer_id = customers.id
