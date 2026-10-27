

| Test ID | Module | Input | Expected | Actual | Status |
|---|---|---|---|---|---|
| REL-PROVISION-04 | Final managed teacher bootstrap gate | Latest approved secure card; fresh-shell Boolean-only policy check and read-only managed TLS counts. Provisioning command withheld. | Proceed only with a valid 12–128 character value and absent target account. | Password present=true but in-range=false; managed users=0, assignments=0, target account absent. No provisioner call or data write. | BLOCKED |
