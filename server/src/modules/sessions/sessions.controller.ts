// Sessions controller: thin HTTP layer. Validates with the DTO,
// calls the service, sends the answer. No business logic here.
import { catchErrors } from "../../errors";
import { SessionsService } from "./sessions.service";
import { FeedbackBodyDto, SearchBodyDto } from "./sessions.dto";

function faultOf(req: any) {
  return {
    fault: req.header("X-Debug-Fault") ?? undefined,
    faultCount: req.header("X-Debug-Fault-Count")
      ? Number(req.header("X-Debug-Fault-Count"))
      : undefined,
  };
}

export class SessionsController {
  constructor(private svc: SessionsService) {}

  // Arrow fields keep `this` bound when Express calls them as plain handlers.
  catalog = (_req: any, res: any): void => {
    res.json(this.svc.catalog());
  };

  create = catchErrors(async (req, res) => {
    res.json(await this.svc.create(req.body?.query, faultOf(req)));
  });

  search = catchErrors(async (req, res) => {
    const body = SearchBodyDto.parse(req.body ?? {});
    res.json(await this.svc.search(req.params.id, body, faultOf(req)));
  });

  feedback = catchErrors(async (req, res) => {
    const body = FeedbackBodyDto.parse(req.body ?? {});
    res.json(await this.svc.feedback(req.params.id, body, faultOf(req)));
  });

  freeze = catchErrors(async (req, res) => {
    res.json(await this.svc.freeze(req.params.id, faultOf(req)));
  });
}
