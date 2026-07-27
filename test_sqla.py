from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

Base = declarative_base()
class Feed(Base):
    __tablename__ = 'feeds'
    id = Column(Integer, primary_key=True)
    val = Column(Integer, default=0)

engine = create_engine('sqlite:///:memory:', echo=False)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

session = Session()
f = Feed()
session.add(f)
session.commit()

session = Session()
feeds = session.query(Feed).all()
for feed in feeds:
    feed.val = 5
    session.commit() # This expires `feed`
    
    feed.val = 10
    session.commit()

print(session.query(Feed).first().val)
