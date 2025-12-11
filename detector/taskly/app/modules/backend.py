from celery import states
from celery.backends.mongodb import MongoBackend
from kombu.exceptions import EncodeError
from pymongo.errors import InvalidDocument


class CollectionMongoBackend(MongoBackend):
    """ Custom celery mongo backend that uses separate collections for each task. """


    def _store_result(self, task_id, result, state, traceback=None, request=None, **kwargs):
        meta = self._get_result_meta(result=self.encode(result), state=state, traceback=traceback, request=request, format_date=False)
        meta["_id"] = task_id
        task_name = request.args[0]
        try:
            self.database[task_name].replace_one({"_id": task_id}, meta, upsert=True)
        except InvalidDocument as exc:
            raise EncodeError(exc)
        return result


    def _get_task_meta_for(self, task_id):
        for collection in self.database.list_collection_names():
            obj = collection.find_one({"_id": task_id})
            if obj:
                if self.app.conf.find_value_for_key("extended", "result"):
                    return self.meta_from_decoded({
                        "name": obj["name"],
                        "args": obj["args"],
                        "task_id": obj["_id"],
                        "queue": obj["queue"],
                        "kwargs": obj["kwargs"],
                        "status": obj["status"],
                        "worker": obj["worker"],
                        "retries": obj["retries"],
                        "children": obj["children"],
                        "date_done": obj["date_done"],
                        "traceback": obj["traceback"],
                        "result": self.decode(obj["result"]),
                    })
                return self.meta_from_decoded({
                    "task_id": obj["_id"],
                    "status": obj["status"],
                    "result": self.decode(obj["result"]),
                    "date_done": obj["date_done"],
                    "traceback": obj["traceback"],
                    "children": obj["children"],
                })
        return {"status": states.PENDING, "result": None}


    def _forget(self, task_id):
        for collection in self.database.list_collection_names():
            collection.delete_one({"_id": task_id})


    def cleanup(self):
        if not self.expires:
            return
        for collection in self.database.list_collection_names():
            collection.delete_many(
                {"date_done": {"$lt": self.app.now() - self.expires_delta}},
            )
        self.group_collection.delete_many(
            {"date_done": {"$lt": self.app.now() - self.expires_delta}},
        )
