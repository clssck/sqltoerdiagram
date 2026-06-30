select
	1 as id,
	orders.id as order_id,
	products.id as product_id,
	2 as quantity
from {{ ref('orders') }} as orders
join {{ ref("products") }} as products on products.id = 1
