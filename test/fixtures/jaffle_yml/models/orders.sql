select
	orders.id,
	orders.customer_id,
	orders.status
from {{ source('raw', 'payments') }} as payments
join {{ ref('customers') }} as customers on customers.id = payments.order_id
join (select 1 as id, 1 as customer_id, 'placed' as status) as orders on orders.customer_id = customers.id
