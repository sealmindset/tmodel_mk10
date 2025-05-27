pg_dump -U postgres -h localhost \
  -F c \
  -b \
  -v \
  -f backups/tmodel_$(date +%Y%m%d).dump \
  postgres

# pg_restore -U postgres -h localhost \
#  -d postgres \
#  -v ~/backups/postgres_20250526.dump

# dropdb -U postgres -h localhost postgres

# createdb -U postgres -h localhost postgres
