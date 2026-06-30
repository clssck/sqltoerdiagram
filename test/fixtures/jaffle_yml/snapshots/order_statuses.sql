{% snapshot order_status_snapshot %}
	{{
		config(
			target_schema='snapshots',
			unique_key='id',
			strategy='check',
			check_cols=['status']
		)
	}}
select id, customer_id, status
from {{ ref('orders') }}
{% endsnapshot %}
